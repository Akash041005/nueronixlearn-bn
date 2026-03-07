import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import Admin from '../models/Admin';
import User from '../models/User';
import Course from '../models/Course';
import { Exam } from '../models/Exam';
import Recommendation from '../models/Recommendation';
import Feedback from '../models/Feedback';
import UserProgress from '../models/UserProgress';
import UserTopicProgress from '../models/UserTopicProgress';
import Subject from '../models/Subject';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'nueronixlearn-secret-admin';

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const admin = await Admin.findOne({ username: value.username });
    if (!admin || !(await admin.comparePassword(value.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin._id, isSuperAdmin: admin.isSuperAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================
// AUTH MIDDLEWARE
// ======================

const authenticateAdmin = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).adminId = decoded.adminId;
    (req as any).isSuperAdmin = decoded.isSuperAdmin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ======================
// DASHBOARD STATS
// ======================

router.get('/stats', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalAdmins,
      activeTeachers,
      activeStudents,
      totalCourses,
      totalExams,
      totalEnrollments,
      activeUsersWeek,
      activeUsersMonth,
      blockedUsers,
      newUsersWeek,
      totalSubjects,
    ] = await Promise.all([
      Admin.countDocuments(),
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'student', isActive: true }),
      Course.countDocuments(),
      Exam.countDocuments(),
      UserProgress.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } }),
      User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Subject.countDocuments(),
    ]);

    const totalUsers = activeTeachers + activeStudents;

    // Top 10 most studied subjects (by number of unique learners)
    const topSubjectsAgg = await Subject.aggregate([
      { $group: { _id: '$subject', learnerCount: { $sum: 1 } } },
      { $sort: { learnerCount: -1 } },
      { $limit: 10 },
      { $project: { subject: '$_id', learnerCount: 1, _id: 0 } },
    ]);

    // Top 10 most completed topics across all users
    const topCompletedTopics = await UserTopicProgress.aggregate([
      { $match: { completed: true, subtopicTitle: '' } },
      { $group: { _id: { subject: '$subject', topic: '$topicTitle' }, completions: { $sum: 1 } } },
      { $sort: { completions: -1 } },
      { $limit: 10 },
      { $project: { subject: '$_id.subject', topic: '$_id.topic', completions: 1, _id: 0 } },
    ]);

    // Top 10 most completed subtopics
    const topCompletedSubtopics = await UserTopicProgress.aggregate([
      { $match: { completed: true, subtopicTitle: { $ne: '' } } },
      { $group: { _id: { subject: '$subject', topic: '$topicTitle', subtopic: '$subtopicTitle' }, completions: { $sum: 1 } } },
      { $sort: { completions: -1 } },
      { $limit: 10 },
      { $project: { subject: '$_id.subject', topic: '$_id.topic', subtopic: '$_id.subtopic', completions: 1, _id: 0 } },
    ]);

    // User growth: registrations per day for last 14 days
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const recentUsers   = await User.find().sort({ createdAt: -1 }).limit(10).select('-password');
    const recentCourses = await Course.find().sort({ createdAt: -1 }).limit(5);

    res.json({
      stats: {
        totalUsers,
        totalAdmins,
        totalTeachers: activeTeachers,
        totalStudents: activeStudents,
        totalCourses,
        totalExams,
        totalEnrollments,
        activeUsersWeek,
        activeUsersMonth,
        blockedUsers,
        newUsersWeek,
        totalSubjects,
      },
      topSubjects:         topSubjectsAgg,
      topCompletedTopics,
      topCompletedSubtopics,
      userGrowth,
      recentUsers,
      recentCourses,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ======================
// USER MANAGEMENT
// ======================

router.get('/users', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) query.role = role;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    res.json({ users, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.params.id);

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    let progress = [];
    let recommendations = [];
    let userProgress = [];
    let userExams = [];
    let recentActivity = [];
    let userTodos = [];

    try {
      progress = await UserProgress.find({ userId: req.params.id });
    } catch (e) { console.error('Progress error:', e.message); }

    try {
      recommendations = await Recommendation.find({ userId: req.params.id });
    } catch (e) { console.error('Recommendation error:', e.message); }

    try {
      userProgress = await UserProgress.find({ userId: req.params.id })
        .populate('courseId', 'title category thumbnail enrollments');
    } catch (e) { console.error('UserProgress error:', e.message); }

    try {
      const Exam = require('../models/Exam');
      userExams = await Exam.find({ 'submissions.userId': req.params.id })
        .select('title questions settings createdAt');
    } catch (e) { console.error('Exam error:', e.message); }

    try {
      recentActivity = await UserProgress.find({ userId: req.params.id })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('courseId', 'title');
    } catch (e) { console.error('RecentActivity error:', e.message); }

    try {
      const UserTodo = require('../models/UserTodo');
      userTodos = await UserTodo.find({ userId: req.params.id });
    } catch (e) { console.error('UserTodo error:', e.message); }

    // Get Weak Topics
    let weakTopics = [];
    try {
      const WeakTopic = require('../models/WeakTopic');
      weakTopics = await WeakTopic.find({ userId: req.params.id });
    } catch (e) { console.error('WeakTopic error:', e.message); }

    // Get AI Usage
    let aiUsage = null;
    try {
      const AIUsage = require('../models/AIUsage');
      aiUsage = await AIUsage.findOne({ userId: req.params.id });
    } catch (e) { console.error('AIUsage error:', e.message); }

    // Get Diary entries count
    let diaryCount = 0;
    try {
      const Diary = require('../models/Diary');
      diaryCount = await Diary.countDocuments({ userId: req.params.id });
    } catch (e) { console.error('Diary error:', e.message); }

    // Calculate stats
    const completedCourses = progress.filter((p: any) => p.completed).length;
    const totalTimeSpent = progress.reduce((acc: number, p: any) => acc + (p.timeSpent || 0), 0);
    const averageScore = progress.length > 0 
      ? progress.reduce((acc: number, p: any) => acc + (p.score || 0), 0) / progress.length 
      : 0;

    res.json({ 
      user, 
      progress, 
      recommendations,
      enrolledCourses: userProgress,
      examResults: userExams,
      recentActivity,
      todos: userTodos,
      weakTopics,
      aiUsage,
      diaryCount,
      stats: {
        completedCourses,
        totalTimeSpent,
        averageScore: Math.round(averageScore),
        totalProgress: progress.length,
        completedTodos: userTodos.filter((t: any) => t.completed).length,
        totalTodos: userTodos.length,
        totalWeakTopics: weakTopics.length,
        completedWeakTopics: weakTopics.filter((t: any) => t.completed).length,
        totalExams: userExams.length,
        totalRecommendations: recommendations.length
      }
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

router.put('/users/:id/role', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Role updated', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Block or unblock a user  (body: { blocked: true|false })
router.put('/users/:id/block', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const blocked = Boolean(req.body.blocked);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: !blocked },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: blocked ? 'User blocked' : 'User unblocked', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Update user name / email by admin
router.put('/users/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body;
    const update: any = {};
    if (name)  update.name  = name;
    if (email) update.email = email.toLowerCase();
    if (role && ['student', 'teacher', 'admin'].includes(role)) update.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.findByIdAndDelete(req.params.id);
    await UserProgress.deleteMany({ userId: req.params.id });
    await Recommendation.deleteMany({ userId: req.params.id });
    await Feedback.deleteMany({ userId: req.params.id });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ======================
// COURSE MANAGEMENT
// ======================

router.get('/courses', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, category, featured } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (featured === 'true') query.featured = true;

    const courses = await Course.find(query)
      .populate('teacherId', 'name email')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Course.countDocuments(query);

    res.json({ courses, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.get('/courses/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const course = await Course.findById(req.params.id).populate('teacherId', 'name email');
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const enrollments = await UserProgress.find({ courseId: req.params.id });

    res.json({ course, enrollments: enrollments.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

router.put('/courses/:id/featured', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { featured } = req.body;
    const course = await Course.findByIdAndUpdate(req.params.id, { featured }, { new: true });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    res.json({ message: 'Course featured status updated', course });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/courses/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    await Course.findByIdAndDelete(req.params.id);
    await UserProgress.deleteMany({ courseId: req.params.id });

    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ======================
// EXAM MANAGEMENT
// ======================

router.get('/exams', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, published } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } }
      ];
    }
    if (published !== undefined) query.published = published === 'true';

    const exams = await Exam.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Exam.countDocuments(query);

    res.json({ exams, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

router.delete('/exams/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    await Exam.findByIdAndDelete(req.params.id);

    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

// ======================
// ANALYTICS
// ======================

router.get('/analytics', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const courseGrowth = await Course.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const topCourses = await Course.find().sort({ enrollments: -1 }).limit(10).select('title enrollments');
    const topTeachers = await User.find({ role: 'teacher' }).sort({ 'teacherProfile.totalStudents': -1 }).limit(10).select('name email teacherProfile');

    const feedbackSummary = await Feedback.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({
      userGrowth,
      courseGrowth,
      topCourses,
      topTeachers,
      feedbackSummary
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ======================
// ADMIN MANAGEMENT (existing)
// ======================

router.get('/list', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    if (!(req as any).isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can list admins' });
    }
    const admins = await Admin.find().select('-password');
    res.json({ admins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

router.post('/add', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    if (!(req as any).isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can add admins' });
    }

    const { username, password, email, isSuperAdmin, permissions } = req.body;
    const existing = await Admin.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: 'Username or email already exists' });

    const adminPermissions = isSuperAdmin ? {
      manageUsers: true,
      manageCourses: true,
      manageExams: true,
      manageAdmins: true,
      viewAnalytics: true,
      manageContent: true
    } : (permissions || {
      manageUsers: false,
      manageCourses: false,
      manageExams: false,
      manageAdmins: false,
      viewAnalytics: false,
      manageContent: false
    });

    const admin = new Admin({ 
      username, 
      password, 
      email, 
      isSuperAdmin: isSuperAdmin || false,
      permissions: adminPermissions
    });
    await admin.save();

    res.status(201).json({ message: 'Admin created', admin: { id: admin._id, username, email, isSuperAdmin: admin.isSuperAdmin, permissions: admin.permissions } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    if (!(req as any).isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can remove admins' });
    }

    if ((req as any).adminId === req.params.id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    res.json({ message: 'Admin removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

export default router;
