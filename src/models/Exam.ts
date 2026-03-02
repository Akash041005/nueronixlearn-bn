import mongoose, { Document, Schema } from 'mongoose';

export interface IExam extends Document {
  title: string;
  description: string;
  courseId?: mongoose.Types.ObjectId;
  instructor: mongoose.Types.ObjectId;
  questions: Array<{
    questionId: mongoose.Types.ObjectId;
    text: string;
    type: 'multiple_choice' | 'short_answer' | 'essay' | 'code';
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
    points: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  settings: {
    timeLimit: number;
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    allowReview: boolean;
    maxAttempts: number;
    showCorrectAnswers: 'immediately' | 'after_submission' | 'after_deadline';
  };
  schedule: {
    startTime: Date;
    endTime: Date;
    isScheduled: boolean;
  };
  status: 'draft' | 'published' | 'archived';
  enrolledStudents: mongoose.Types.ObjectId[];
  totalAttempts: number;
  averageScore: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  tags: string[];
}

export interface IExamAttempt extends Document {
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  answers: Array<{
    questionId: mongoose.Types.ObjectId;
    answer: string;
    isCorrect?: boolean;
    pointsEarned: number;
    timeSpent: number;
  }>;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  startedAt: Date;
  submittedAt?: Date;
  timeSpent: number;
  ipAddress?: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
  flaggedQuestions: mongoose.Types.ObjectId[];
  reviewed: boolean;
  reviewedBy?: mongoose.Types.ObjectId;
}

const examSchema = new Schema<IExam>({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [{
    questionId: { type: Schema.Types.ObjectId },
    text: { type: String, required: true },
    type: { type: String, enum: ['multiple_choice', 'short_answer', 'essay', 'code'], required: true },
    options: [String],
    correctAnswer: String,
    explanation: String,
    points: { type: Number, default: 1 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
  }],
  settings: {
    timeLimit: { type: Number, default: 60 },
    passingScore: { type: Number, default: 70 },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    showResults: { type: Boolean, default: true },
    allowReview: { type: Boolean, default: true },
    maxAttempts: { type: Number, default: 3 },
    showCorrectAnswers: { type: String, enum: ['immediately', 'after_submission', 'after_deadline'], default: 'immediately' }
  },
  schedule: {
    startTime: { type: Date },
    endTime: { type: Date },
    isScheduled: { type: Boolean, default: false }
  },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  enrolledStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  totalAttempts: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  category: { type: String, required: true },
  tags: [String]
}, { timestamps: true });

const attemptSchema = new Schema<IExamAttempt>({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{
    questionId: { type: Schema.Types.ObjectId, required: true },
    answer: String,
    isCorrect: Boolean,
    pointsEarned: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }
  }],
  score: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  submittedAt: Date,
  timeSpent: { type: Number, default: 0 },
  ipAddress: String,
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  flaggedQuestions: [{ type: Schema.Types.ObjectId }],
  reviewed: { type: Boolean, default: false },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

attemptSchema.index({ examId: 1, studentId: 1 });

export const Exam = mongoose.model<IExam>('Exam', examSchema);
export const ExamAttempt = mongoose.model<IExamAttempt>('ExamAttempt', attemptSchema);
