import { Router, Request, Response } from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import WeakTopic from '../models/WeakTopic';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createUserTodos } from '../ml/topicTodoService';

const router = Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).required(),
  phone: Joi.string().allow('').optional(),
  role: Joi.string().valid('student', 'teacher').default('student')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const profileSchema = Joi.object({
  grade: Joi.string(),
  subjectInterests: Joi.array().items(Joi.string()),
  weakAreas: Joi.array().items(Joi.string()),
  preferredLearningStyle: Joi.string().valid('video', 'text', 'practice', 'interactive', 'mixed'),
  learningGoals: Joi.array().items(Joi.string().valid('board_exams', 'jee', 'neet', 'certification', 'skill_improvement', 'knowledge_exploration', 'career')),
  currentPerformanceLevel: Joi.string().valid('below_average', 'average', 'above_average', 'excellent'),
  pacePreference: Joi.string().valid('slow', 'medium', 'fast'),
  languagePreference: Joi.string().default('en'),
  targetExamDate: Joi.date()
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('Registration request body:', req.body);
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    console.log('Validated values:', value);

    const existingUser = await User.findOne({ email: value.email.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    try {
      const user = new User({
        email: value.email.toLowerCase(),
        password: value.password,
        phone: value.phone || '',
        phoneVerified: false,
        name: value.name,
        role: value.role || 'student',
        profile: {
          subjectInterests: [],
          weakAreas: [],
          preferredLearningStyle: 'mixed',
          learningGoals: [],
          currentPerformanceLevel: 'average',
          pacePreference: 'medium',
          languagePreference: 'en'
        },
        teacherProfile: value.role === 'teacher' ? {
          qualifications: [],
          expertise: [],
          experienceYears: 0,
          hourlyRate: 0,
          totalStudents: 0,
          totalCourses: 0,
          averageRating: 0,
          totalRatings: 0,
          bio: '',
          isVerified: false,
          featured: false
        } : undefined,
        studentProfile: value.role === 'student' ? {
          educationLevel: '',
          targetGoals: [],
          learningStreak: 0,
          totalXP: 0,
          level: 1,
          badges: [],
          completedPaths: [],
          subscriptionPlan: 'free'
        } : undefined
      });
      
      await user.save();
      console.log('User created successfully:', user._id);

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'nueronixlearn-secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: { 
          id: user._id, 
          email: user.email, 
          name: user.name, 
          role: user.role,
          onboardingCompleted: user.onboardingCompleted,
          profile: user.profile
        }
      });
    } catch (saveError: any) {
      console.error('Database save error:', saveError);
      if (saveError.code === 11000) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      throw saveError;
    }
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findOne({ email: value.email });
    if (!user || !(await user.comparePassword(value.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'neurlearn-secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        profile: user.profile
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/refresh', authenticate, async (req: AuthRequest, res: Response) => {
  const token = jwt.sign(
    { userId: req.user?._id },
    process.env.JWT_SECRET || 'neurlearn-secret',
    { expiresIn: '7d' }
  );
  res.json({ token });
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.profile = { ...user.profile, ...value };
    await user.save();

    res.json({ 
      message: 'Profile updated successfully',
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        profile: user.profile,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// OTP storage (in production, use Redis)
const otpStore: Map<string, { otp: string; expiresAt: Date; verified: boolean }> = new Map();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOTPEmail(email: string, otp: string): void {
  console.log(`[OTP] Sending to ${email}: ${otp}`);
}

// Send OTP to email
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser && existingUser.password) {
      return res.status(400).json({ error: 'Email already registered. Please login.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    otpStore.set(email.toLowerCase(), { otp, expiresAt, verified: false });

    sendOTPEmail(email.toLowerCase(), otp);

    res.json({ message: 'OTP sent to your email', expiresIn: '10 minutes' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and register
router.post('/verify-otp-register', async (req: Request, res: Response) => {
  try {
    const { email, otp, name, password, role, phone } = req.body;

    if (!email || !otp || !name || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const stored = otpStore.get(email.toLowerCase());
    if (!stored) return res.status(400).json({ error: 'OTP not requested. Request OTP first.' });
    if (new Date() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    }
    if (stored.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const user = new User({
      email: email.toLowerCase(),
      password,
      phone: phone || '',
      phoneVerified: false,
      name,
      role: role || 'student',
      profile: {
        subjectInterests: [],
        weakAreas: [],
        preferredLearningStyle: 'mixed',
        learningGoals: [],
        currentPerformanceLevel: 'average',
        pacePreference: 'medium',
        languagePreference: 'en'
      },
      studentProfile: {
        educationLevel: '',
        targetGoals: [],
        learningStreak: 0,
        totalXP: 0,
        level: 1,
        badges: [],
        completedPaths: [],
        subscriptionPlan: 'free'
      }
    });

    await user.save();
    otpStore.delete(email.toLowerCase());

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'nueronixlearn-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        onboardingCompleted: user.onboardingCompleted,
        profile: user.profile
      }
    });
  } catch (err: any) {
    console.error('OTP register error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Send OTP for login verification
router.post('/send-login-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    otpStore.set(`login:${email.toLowerCase()}`, { otp, expiresAt, verified: false });

    sendOTPEmail(email.toLowerCase(), otp);

    res.json({ message: 'OTP sent to your email', expiresIn: '10 minutes' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and login
router.post('/verify-otp-login', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const stored = otpStore.get(`login:${email.toLowerCase()}`);
    if (!stored) return res.status(400).json({ error: 'OTP not requested. Request OTP first.' });
    if (new Date() > stored.expiresAt) {
      otpStore.delete(`login:${email.toLowerCase()}`);
      return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    }
    if (stored.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.lastLogin = new Date();
    await user.save();
    otpStore.delete(`login:${email.toLowerCase()}`);

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'nueronixlearn-secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        onboardingCompleted: user.onboardingCompleted,
        profile: user.profile
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update phone number
router.put('/phone', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.phone = phone;
    user.phoneVerified = false;
    await user.save();

    res.json({ message: 'Phone number updated', phone: user.phone, phoneVerified: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update phone' });
  }
});

router.put('/complete-onboarding', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.profile = { ...user.profile, ...value };
    user.onboardingCompleted = true;
    await user.save();

    // Create weak topics and todos from user's difficult subjects
    const weakAreas = value.weakAreas || [];
    const subjectInterests = value.subjectInterests || [];
    
    const defaultTopics: Record<string, string[]> = {
      'Mathematics': ['Algebra Basics', 'Geometry', 'Arithmetic'],
      'Physics': ['Mechanics', 'Basic Physics', 'Force'],
      'Chemistry': ['Atomic Structure', 'Chemical Reactions', 'Basic Chemistry'],
      'Biology': ['Cell Biology', 'Human Body', 'Basic Biology'],
      'English': ['Grammar', 'Vocabulary', 'Reading'],
      'Computer Science': ['Programming Basics', 'Problem Solving', 'Logic'],
      'History': ['World History', 'Ancient History', 'Modern History'],
      'Geography': ['Physical Geography', 'Map Reading', 'Climate'],
      'Economics': ['Basic Economics', 'Microeconomics', 'Macroeconomics'],
      'Business Studies': ['Business Basics', 'Management', 'Marketing']
    };

    for (const subject of weakAreas) {
      // Create weak topic
      const existingTopic = await WeakTopic.findOne({
        userId: user._id,
        subject: subject.toLowerCase(),
        topicName: { $regex: new RegExp(`^${subject}$`, 'i') }
      });

      if (!existingTopic) {
        const weakTopic = new WeakTopic({
          userId: user._id,
          topicName: subject,
          subject: subject.toLowerCase(),
          completed: false,
          source: 'onboarding'
        });
        await weakTopic.save();

        // Create todo from default topics for this subject
        const topicsForSubject = defaultTopics[subject] || [`${subject} Basics`];
        for (let i = 0; i < topicsForSubject.length; i++) {
          await createUserTodos(user._id.toString(), subject.toLowerCase(), topicsForSubject[i]);
        }
      }
    }

    // Also create todos for subject interests
    for (const subject of subjectInterests) {
      if (!weakAreas.includes(subject)) {
        const topicsForSubject = defaultTopics[subject] || [`${subject} Introduction`];
        for (let i = 0; i < Math.min(2, topicsForSubject.length); i++) {
          await createUserTodos(user._id.toString(), subject.toLowerCase(), topicsForSubject[i]);
        }
      }
    }

    res.json({ 
      message: 'Onboarding completed successfully',
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        profile: user.profile,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;
