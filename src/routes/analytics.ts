import { Router, Response } from 'express';
import User from '../models/User';
import Course from '../models/Course';
import UserProgress from '../models/UserProgress';
import Recommendation from '../models/Recommendation';
import Feedback from '../models/Feedback';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id);
    const progress = await UserProgress.find({ userId: req.user?._id });
    
    const enrolledCourses = await Course.find({
      _id: { $in: progress.map(p => p.courseId) }
    });

    const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);
    const completedCourses = progress.filter(p => 
      enrolledCourses.some(c => c.modules.length === p.completedModules.length)
    ).length;

    const recentActivity = progress
      .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
      .slice(0, 5)
      .map(p => {
        const course = enrolledCourses.find(c => c._id.toString() === p.courseId.toString());
        return {
          courseId: p.courseId,
          courseName: course?.title || 'Unknown',
          lastAccessed: p.lastAccessed,
          progress: course ? Math.round((p.completedModules.length / course.modules.length) * 100) : 0
        };
      });

    res.json({
      stats: {
        enrolledCourses: enrolledCourses.length,
        completedCourses,
        totalTimeSpent,
        currentStreak: user?.progress.currentStreak || 0
      },
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const totalUsers = await User.countDocuments({ role: 'student' });
    const totalInstructors = await User.countDocuments({ role: 'instructor' });
    const activeUsers = await User.countDocuments({
      updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    const totalCourses = await Course.countDocuments();
    const totalEnrollments = await UserProgress.countDocuments();

    const completedProgress = await UserProgress.countDocuments({ completed: true });
    const completionRate = totalEnrollments > 0
      ? Math.round((completedProgress / totalEnrollments) * 100)
      : 0;

    const courseEngagement = await Course.find()
      .sort({ enrolledCount: -1 })
      .limit(10)
      .select('title enrolledCount rating category')
      .lean();

    res.json({
      totalUsers,
      totalInstructors,
      activeUsers,
      totalCourses,
      totalEnrollments,
      completionRate,
      courseEngagement
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/recommendations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const recommendations = await Recommendation.find()
      .populate('userId', 'name email')
      .sort({ generatedAt: -1 })
      .limit(50)
      .lean();

    const totalGenerated = await Recommendation.countDocuments();
    const withFeedback = await Recommendation.countDocuments({
      'feedbackHistory.0': { $exists: true }
    });

    const intentDistribution = await Recommendation.aggregate([
      { $group: { _id: '$intent', count: { $sum: 1 } } }
    ]);

    res.json({
      recentRecommendations: recommendations,
      totalGenerated,
      adjustedBasedOnFeedback: withFeedback,
      intentDistribution
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/feedback-trends', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const feedbackByType = await Feedback.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const sentimentDistribution = await Feedback.aggregate([
      { $match: { createdAt: { $gte: last30Days }, sentiment: { $ne: null } } },
      { $group: { _id: '$sentiment', count: { $sum: 1 } } }
    ]);

    const recentFeedback = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'name email')
      .lean();

    res.json({
      feedbackByType,
      sentimentDistribution,
      recentFeedback
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/performance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const progress = await UserProgress.find({ userId: req.user?._id });
    
    const performance = progress.map(p => ({
      courseId: p.courseId,
      assessmentScores: p.assessmentScores,
      averageScore: p.assessmentScores.length > 0
        ? p.assessmentScores.reduce((sum, s) => sum + s.score, 0) / p.assessmentScores.length
        : 0
    }));

    res.json({ performance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/cognitive-load', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const progress = await UserProgress.find({ userId: req.user?._id });
    
    const cognitiveLoad = progress.map(p => ({
      courseId: p.courseId,
      history: p.cognitiveLoadHistory.slice(-20),
      currentLoad: p.cognitiveLoadHistory.length > 0 
        ? p.cognitiveLoadHistory[p.cognitiveLoadHistory.length - 1].loadLevel
        : 50
    }));

    res.json({ cognitiveLoad });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/daily-progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const progress = await UserProgress.find({ userId });
    
    const last7Days: { date: string; progress: number; timeSpent: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let dayProgress = 0;
      let dayTimeSpent = 0;
      
      progress.forEach(p => {
        if (p.cognitiveLoadHistory && p.cognitiveLoadHistory.length > 0) {
          const dayEntries = p.cognitiveLoadHistory.filter((entry: any) => {
            const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
            return entryDate === dateStr;
          });
          
          if (dayEntries.length > 0) {
            dayProgress = Math.min(100, dayProgress + 20);
          }
        }
        
        if (p.lastAccessed) {
          const lastAccessDate = new Date(p.lastAccessed).toISOString().split('T')[0];
          if (lastAccessDate === dateStr) {
            dayTimeSpent += (p.timeSpent || 0);
          }
        }
      });
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      last7Days.push({
        name: dayName,
        progress: dayProgress,
        timeSpent: Math.round(dayTimeSpent / 60)
      });
    }
    
    res.json({ dailyProgress: last7Days });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
