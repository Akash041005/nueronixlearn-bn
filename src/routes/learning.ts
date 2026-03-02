import { Router, Response } from 'express';
import Course from '../models/Course';
import UserProgress from '../models/UserProgress';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/next/:courseId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    let progress = await UserProgress.findOne({ userId: req.user?._id, courseId: course._id });
    
    if (!progress) {
      progress = new UserProgress({
        userId: req.user?._id,
        courseId: course._id,
        completedModules: [],
        currentModule: course.modules[0]?._id
      });
      await progress.save();
    }

    const nextModule = course.modules.find(
      m => !progress?.completedModules.some(cm => cm.toString() === m._id.toString())
    );

    if (!nextModule) {
      return res.json({ completed: true, message: 'Course completed' });
    }

    res.json({ 
      module: nextModule,
      progress: {
        completed: progress.completedModules.length,
        total: course.modules.length,
        percentage: Math.round((progress.completedModules.length / course.modules.length) * 100)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, moduleId, completed, timeSpent } = req.body;

    let progress = await UserProgress.findOne({ userId: req.user?._id, courseId });
    if (!progress) {
      progress = new UserProgress({ userId: req.user?._id, courseId });
    }

    if (completed && moduleId) {
      if (!progress.completedModules.some(m => m.toString() === moduleId)) {
        progress.completedModules.push(moduleId);
      }
    }

    progress.timeSpent += timeSpent || 0;
    progress.lastAccessed = new Date();
    await progress.save();

    res.json({ progress });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/submit-answer', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, assessmentId, questionId, answer } = req.body;
    
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const assessment = course.assessments.id(assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const question = assessment.questions.id(questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const isCorrect = answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();

    res.json({
      correct: isCorrect,
      explanation: question.explanation,
      correctAnswer: question.correctAnswer
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/progress/:courseId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const progress = await UserProgress.findOne({ 
      userId: req.user?._id, 
      courseId: req.params.courseId 
    });

    if (!progress) {
      return res.json({ 
        completedModules: [], 
        currentModule: null, 
        timeSpent: 0,
        percentage: 0 
      });
    }

    const course = await Course.findById(req.params.courseId);
    const percentage = course 
      ? Math.round((progress.completedModules.length / course.modules.length) * 100)
      : 0;

    res.json({ ...progress.toObject(), percentage });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
