import mongoose, { Document, Schema } from 'mongoose';

export interface IModule {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  type: 'video' | 'text' | 'quiz' | 'interactive';
  duration: number;
  order: number;
  concepts: string[];
  videoUrl?: string;
  resources?: Array<{ title: string; url: string; type: string }>;
}

export interface IQuestion {
  _id: mongoose.Types.ObjectId;
  text: string;
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'code';
  options?: string[];
  correctAnswer: string;
  explanation: string;
  concepts: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface IAssessment {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  questions: IQuestion[];
  passingScore: number;
  timeLimit: number;
  shuffleQuestions: boolean;
  showResults: boolean;
}

export interface ICourse extends Document {
  title: string;
  description: string;
  shortDescription: string;
  instructor: mongoose.Types.ObjectId;
  thumbnail: string;
  previewVideo?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  subcategory?: string;
  tags: string[];
  concepts: string[];
  modules: IModule[];
  assessments: IAssessment[];
  prerequisites: mongoose.Types.ObjectId[];
  price: number;
  discountedPrice?: number;
  currency: string;
  isFree: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  language: string;
  duration: number;
  enrolledCount: number;
  rating: number;
  totalRatings: number;
  reviews: Array<{
    userId: mongoose.Types.ObjectId;
    rating: number;
    comment: string;
    createdAt: Date;
  }>;
  whatYouWillLearn: string[];
  requirements: string[];
  certificateEnabled: boolean;
  certificateTemplate?: string;
  enrollmentType: 'open' | 'approval' | 'paid';
  maxStudents?: number;
  startDate?: Date;
  endDate?: Date;
}

const moduleSchema = new Schema<IModule>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['video', 'text', 'quiz', 'interactive'], required: true },
  duration: { type: Number, default: 10 },
  order: { type: Number, required: true },
  concepts: [String],
  videoUrl: String,
  resources: [{
    title: String,
    url: String,
    type: String
  }]
});

const questionSchema = new Schema<IQuestion>({
  text: { type: String, required: true },
  type: { type: String, enum: ['multiple_choice', 'short_answer', 'essay', 'code'], required: true },
  options: [String],
  correctAnswer: { type: String, required: true },
  explanation: { type: String, default: '' },
  concepts: [String],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  points: { type: Number, default: 1 }
});

const assessmentSchema = new Schema<IAssessment>({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  questions: [questionSchema],
  passingScore: { type: Number, default: 70 },
  timeLimit: { type: Number, default: 60 },
  shuffleQuestions: { type: Boolean, default: false },
  showResults: { type: Boolean, default: true }
});

const courseSchema = new Schema<ICourse>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  shortDescription: { type: String, default: '' },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  thumbnail: { type: String, default: '' },
  previewVideo: String,
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  category: { type: String, required: true },
  subcategory: String,
  tags: [String],
  concepts: [String],
  modules: [moduleSchema],
  assessments: [assessmentSchema],
  prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
  price: { type: Number, default: 0 },
  discountedPrice: Number,
  currency: { type: String, default: 'USD' },
  isFree: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  language: { type: String, default: 'English' },
  duration: { type: Number, default: 0 },
  enrolledCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  reviews: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, required: true },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  whatYouWillLearn: [String],
  requirements: [String],
  certificateEnabled: { type: Boolean, default: true },
  certificateTemplate: String,
  enrollmentType: { type: String, enum: ['open', 'approval', 'paid'], default: 'open' },
  maxStudents: Number,
  startDate: Date,
  endDate: Date
}, { timestamps: true });

courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ category: 1, isPublished: 1 });
courseSchema.index({ instructor: 1 });

export default mongoose.model<ICourse>('Course', courseSchema);
