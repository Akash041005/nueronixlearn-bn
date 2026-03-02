import { Router, Response } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { DiaryEntry, DiaryPassword } from '../models/Diary';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const entrySchema = Joi.object({
  date: Joi.date().required(),
  title: Joi.string().required(),
  content: Joi.string().required(),
  mood: Joi.string().valid('great', 'good', 'okay', 'bad', 'terrible'),
  tags: Joi.array().items(Joi.string()),
  courseId: Joi.string(),
  goalsCompleted: Joi.array().items(Joi.string()),
  goalsMissed: Joi.array().items(Joi.string()),
  nextDayGoals: Joi.array().items(Joi.string()),
  reflections: Joi.string(),
  isPrivate: Joi.boolean()
});

router.get('/entries', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, tag } = req.query;
    const query: any = { userId: req.user?._id };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }
    if (tag) query.tags = tag;

    const entries = await DiaryEntry.find(query)
      .sort({ date: -1 })
      .limit(50);

    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/entries/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await DiaryEntry.findOne({ 
      _id: req.params.id, 
      userId: req.user?._id 
    });
    
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/entries', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = entrySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const entry = new DiaryEntry({
      ...value,
      userId: req.user?._id
    });
    await entry.save();

    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/entries/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await DiaryEntry.findOne({ 
      _id: req.params.id, 
      userId: req.user?._id 
    });
    
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const { error, value } = entrySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    Object.assign(entry, value);
    await entry.save();

    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/entries/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await DiaryEntry.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user?._id 
    });
    
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    res.json({ message: 'Entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/lock', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await DiaryPassword.findOneAndUpdate(
      { userId: req.user?._id },
      { 
        passwordHash,
        userId: req.user?._id,
        updatedAt: new Date(),
        lastVerified: new Date()
      },
      { upsert: true }
    );

    res.json({ message: 'Diary locked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/unlock', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    
    const diaryPassword = await DiaryPassword.findOne({ userId: req.user?._id });
    
    if (!diaryPassword) {
      return res.json({ unlocked: true });
    }

    const isValid = await bcrypt.compare(password, diaryPassword.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password', unlocked: false });
    }

    diaryPassword.lastVerified = new Date();
    await diaryPassword.save();

    res.json({ unlocked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const diaryPassword = await DiaryPassword.findOne({ userId: req.user?._id });
    const hasPassword = !!diaryPassword;
    res.json({ 
      isLocked: hasPassword,
      hasPassword: hasPassword
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const diaryPassword = await DiaryPassword.findOne({ userId: req.user?._id });
    
    if (diaryPassword) {
      const isValid = await bcrypt.compare(currentPassword, diaryPassword.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await DiaryPassword.findOneAndUpdate(
      { userId: req.user?._id },
      { 
        passwordHash,
        userId: req.user?._id,
        updatedAt: new Date()
      },
      { upsert: true }
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
