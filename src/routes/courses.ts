import { Router, Response } from 'express';
import Joi from 'joi';
import Course from '../models/Course';
import User from '../models/User';
import UserProgress from '../models/UserProgress';
import Rating from '../models/Rating';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

const courseSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  shortDescription: Joi.string().allow(''),
  thumbnail: Joi.string().allow(''),
  previewVideo: Joi.string().allow(''),
  difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').required(),
  category: Joi.string().required(),
  subcategory: Joi.string().allow(''),
  tags: Joi.array().items(Joi.string()),
  price: Joi.number().min(0),
  discountedPrice: Joi.number(),
  isFree: Joi.boolean(),
  isPublished: Joi.boolean(),
  language: Joi.string().allow(''),
  whatYouWillLearn: Joi.array().items(Joi.string().allow('')),
  requirements: Joi.array().items(Joi.string().allow('')),
  enrollmentType: Joi.string().valid('open', 'approval', 'paid'),
  modules: Joi.array().items(Joi.object({
    title: Joi.string().required(),
    content: Joi.string().allow(''),
    type: Joi.string().valid('video', 'text', 'quiz', 'interactive').required(),
    duration: Joi.number().default(10),
    order: Joi.number().required(),
    videoUrl: Joi.string().allow(''),
    concepts: Joi.array().items(Joi.string())
  }))
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { category, difficulty, search, page = 1, limit = 12, sort = 'popular' } = req.query;

    const query: any = { isPublished: true };

    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$text = { $search: search as string };
    }

    let sortOption: any = {};
    switch (sort) {
      case 'newest': sortOption = { createdAt: -1 }; break;
      case 'price_low': sortOption = { price: 1 }; break;
      case 'price_high': sortOption = { price: -1 }; break;
      case 'rating': sortOption = { rating: -1 }; break;
      default: sortOption = { enrolledCount: -1 };
    }

    const courses = await Course.find(query)
      .populate('instructor', 'name avatar teacherProfile')
      .sort(sortOption)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Course.countDocuments(query);

    res.json({
      courses,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err: any) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await Course.distinct('category', { isPublished: true });
    const categoryData = await Course.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ categories, categoryData });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/featured', async (req: AuthRequest, res: Response) => {
  try {
    const courses = await Course.find({ isPublished: true, isFeatured: true })
      .populate('instructor', 'name avatar teacherProfile')
      .sort({ rating: -1 })
      .limit(6);
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my-courses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const progress = await UserProgress.find({ userId: req.user?._id }).populate('courseId');
    const courses = progress.map(p => ({
      course: p.courseId,
      progress: p.completedModules.length,
      score: p.score,
      lastAccessed: p.lastAccessed,
      completed: p.completed
    }));
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/teacher', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const courses = await Course.find({ instructor: req.user?._id })
      .sort({ createdAt: -1 });
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name avatar teacherProfile');

    if (!course) return res.status(404).json({ error: 'Course not found' });

    let isEnrolled = false;
    if (req.user) {
      const progress = await UserProgress.findOne({
        userId: req.user._id,
        courseId: course._id
      });
      isEnrolled = !!progress;
    }

    res.json({ course, isEnrolled });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = courseSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const course = new Course({
      ...value,
      instructor: req.user?._id
    });
    await course.save();

    const user = await User.findById(req.user?._id);
    if (user) {
      if (!user.teacherProfile) {
        user.teacherProfile = {
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
        } as any;
      }
      user.teacherProfile.totalCourses = (user.teacherProfile.totalCourses || 0) + 1;
      await user.save();
    }

    res.status(201).json({ course });
  } catch (err: any) {
    console.error('Course creation error:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

router.put('/:id', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, instructor: req.user?._id });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { error, value } = courseSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    Object.assign(course, value);
    await course.save();

    res.json({ course });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/enroll', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (!course.isPublished) {
      return res.status(400).json({ error: 'Course is not available for enrollment' });
    }

    const existingProgress = await UserProgress.findOne({
      userId: req.user?._id,
      courseId: course._id
    });

    if (existingProgress) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    if (!course.isFree && course.price > 0) {
      return res.json({
        message: 'Enrolled successfully (free enrollment for demo)',
        progress: null,
        demoEnrollment: true
      });
    }

    const progress = new UserProgress({
      userId: req.user?._id,
      courseId: course._id,
      completedModules: [],
      assessmentScores: [],
      cognitiveLoadHistory: [],
      timeSpent: 0,
      lastAccessed: new Date()
    });
    await progress.save();

    course.enrolledCount += 1;
    await course.save();

    await User.findByIdAndUpdate(course.instructor, {
      $inc: { 'teacherProfile.totalStudents': 1 }
    });

    res.json({ message: 'Enrolled successfully', progress });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/review', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rating, review, categories } = req.body;

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const existingReview = await Rating.findOne({
      teacherId: course.instructor,
      studentId: req.user?._id,
      courseId: course._id
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this course' });
    }

    const newRating = new Rating({
      teacherId: course.instructor,
      studentId: req.user?._id,
      courseId: course._id,
      rating,
      review,
      categories,
      isVerifiedPurchase: true
    });
    await newRating.save();

    const allRatings = await Rating.find({ teacherId: course.instructor });
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

    await User.findByIdAndUpdate(course.instructor, {
      'teacherProfile.averageRating': avgRating,
      'teacherProfile.totalRatings': allRatings.length
    });

    course.rating = avgRating;
    course.totalRatings = allRatings.length;
    await course.save();

    res.json({ message: 'Review submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findOneAndDelete({
      _id: req.params.id,
      instructor: req.user?._id
    });

    if (!course) return res.status(404).json({ error: 'Course not found' });

    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
