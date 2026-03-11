import { Router, Response } from 'express';
import Joi from 'joi';
import { Exam, ExamAttempt } from '../models/Exam';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

const examSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string(),
  courseId: Joi.string(),
  questions: Joi.array().items(Joi.object({
    text: Joi.string().required(),
    type: Joi.string().valid('multiple_choice', 'short_answer', 'essay', 'code').required(),
    options: Joi.array().items(Joi.string()),
    correctAnswer: Joi.string(),
    explanation: Joi.string(),
    points: Joi.number().default(1),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium')
  })),
  settings: Joi.object({
    timeLimit: Joi.number().default(60),
    passingScore: Joi.number().default(70),
    shuffleQuestions: Joi.boolean().default(false),
    shuffleOptions: Joi.boolean().default(false),
    showResults: Joi.boolean().default(true),
    allowReview: Joi.boolean().default(true),
    maxAttempts: Joi.number().default(3)
  }),
  schedule: Joi.object({
    startTime: Joi.date(),
    endTime: Joi.date(),
    isScheduled: Joi.boolean()
  }),
  difficulty: Joi.string().valid('easy', 'medium', 'hard'),
  category: Joi.string().required(),
  tags: Joi.array().items(Joi.string())
});

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, status, category } = req.query;
    const query: any = {};

    if (req.user?.role === 'teacher') {
      query.instructor = req.user._id;
    } else {
      query.status = 'published';
      query.$or = [
        { 'schedule.isScheduled': false },
        { 
          'schedule.isScheduled': true,
          'schedule.startTime': { $lte: new Date() },
          'schedule.endTime': { $gte: new Date() }
        }
      ];
    }

    if (courseId) query.courseId = courseId;
    if (status && req.user?.role === 'teacher') query.status = status;
    if (category) query.category = category;

    const exams = await Exam.find(query)
      .populate('instructor', 'name avatar')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    res.json({ exams });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my-exams', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const attempts = await ExamAttempt.find({ studentId: req.user?._id })
      .populate('examId')
      .sort({ startedAt: -1 });
    
    res.json({ attempts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('instructor', 'name avatar')
      .populate('courseId', 'title');
    
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const attempt = await ExamAttempt.findOne({
      examId: exam._id,
      studentId: req.user?._id
    }).sort({ startedAt: -1 });

    res.json({ exam, attempt });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = examSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const exam = new Exam({
      ...value,
      instructor: req.user?._id,
      status: 'draft'
    });
    await exam.save();

    res.status(201).json({ exam });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, instructor: req.user?._id });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    Object.assign(exam, req.body);
    await exam.save();

    res.json({ exam });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/publish', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, instructor: req.user?._id });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    exam.status = 'published';
    await exam.save();

    res.json({ exam });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    if (exam.status !== 'published') {
      return res.status(400).json({ error: 'Exam is not available' });
    }

    if (exam.schedule.isScheduled) {
      const now = new Date();
      if (now < exam.schedule.startTime || now > exam.schedule.endTime) {
        return res.status(400).json({ error: 'Exam is not available at this time' });
      }
    }

    const existingAttempts = await ExamAttempt.countDocuments({
      examId: exam._id,
      studentId: req.user?._id
    });

    if (existingAttempts >= exam.settings.maxAttempts) {
      return res.status(400).json({ error: 'Maximum attempts reached' });
    }

    let questions = [...exam.questions];
    if (exam.settings.shuffleQuestions) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    const questionsToSend = questions.map(q => ({
      questionId: q.questionId?.toString() || Math.random().toString(36).substr(2, 9),
      text: q.text,
      type: q.type,
      options: exam.settings.shuffleOptions ? q.options?.sort(() => Math.random() - 0.5) : q.options,
      points: q.points
    }));

    res.json({ 
      examTitle: exam.title,
      timeLimit: exam.settings.timeLimit,
      questions: questionsToSend,
      totalPoints: questions.reduce((sum, q) => sum + q.points, 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { answers, timeSpent } = req.body;
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    let totalPoints = 0;
    let earnedPoints = 0;
    const gradedAnswers = exam.questions.map(q => {
      const questionId = q.questionId?.toString();
      const userAnswer = answers.find((a: any) => 
        a.questionId?.toString() === questionId ||
        a.questionId === questionId
      );
      let isCorrect = false;
      
      if (q.type === 'multiple_choice' && userAnswer) {
        const userAns = (userAnswer.answer || '').toLowerCase().trim();
        const correctAns = (q.correctAnswer || '').toLowerCase().trim();
        isCorrect = userAns === correctAns;
      }
      
      if (isCorrect) {
        earnedPoints += q.points;
      }
      
      totalPoints += q.points;
      
      return {
        questionId: questionId,
        answer: userAnswer?.answer || '',
        isCorrect,
        pointsEarned: isCorrect ? q.points : 0,
        timeSpent: userAnswer?.timeSpent || 0
      };
    });

    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = percentage >= exam.settings.passingScore;

    const attempt = new ExamAttempt({
      examId: exam._id,
      studentId: req.user?._id,
      answers: gradedAnswers,
      score: earnedPoints,
      totalPoints,
      percentage,
      passed,
      submittedAt: new Date(),
      timeSpent
    });
    await attempt.save();

    exam.totalAttempts += 1;
    const allAttempts = await ExamAttempt.find({ examId: exam._id });
    exam.averageScore = allAttempts.reduce((sum, a) => sum + a.percentage, 0) / allAttempts.length;
    await exam.save();

    res.json({
      attempt,
      result: {
        score: earnedPoints,
        totalPoints,
        percentage,
        passed,
        passingScore: exam.settings.passingScore,
        showResults: exam.settings.showResults,
        questions: exam.settings.showResults ? exam.questions.map(q => ({
          questionId: q.questionId?.toString(),
          text: q.text,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          userAnswer: gradedAnswers.find(a => a.questionId === q.questionId?.toString())?.answer
        })) : []
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/results', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('instructor', 'name avatar');
    
    if (!exam || exam.instructor._id.toString() !== req.user?._id.toString()) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const attempts = await ExamAttempt.find({ examId: exam._id })
      .populate('studentId', 'name avatar email')
      .sort({ percentage: -1 });

    const stats = {
      totalAttempts: attempts.length,
      passRate: attempts.filter(a => a.passed).length / attempts.length * 100,
      averageScore: exam.averageScore,
      highestScore: Math.max(...attempts.map(a => a.percentage)),
      lowestScore: Math.min(...attempts.map(a => a.percentage))
    };

    res.json({ exam, attempts, stats });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const exam = await Exam.findOneAndDelete({ 
      _id: req.params.id, 
      instructor: req.user?._id 
    });
    
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    
    await ExamAttempt.deleteMany({ examId: req.params.id });
    
    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
