import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserProfile {
  grade?: string;
  subjectInterests: string[];
  weakAreas: string[];
  preferredLearningStyle: 'video' | 'text' | 'practice' | 'interactive' | 'mixed';
  learningGoals: ('board_exams' | 'jee' | 'neet' | 'certification' | 'skill_improvement' | 'knowledge_exploration' | 'career')[];
  currentPerformanceLevel: 'below_average' | 'average' | 'above_average' | 'excellent';
  pacePreference: 'slow' | 'medium' | 'fast';
  languagePreference: string;
  targetExamDate?: Date;
}

export interface ITeacherProfile {
  qualifications: string[];
  expertise: string[];
  experienceYears: number;
  hourlyRate: number;
  totalStudents: number;
  totalCourses: number;
  averageRating: number;
  totalRatings: number;
  bio: string;
  linkedIn?: string;
  website?: string;
  isVerified: boolean;
  featured: boolean;
}

export interface IStudentProfile {
  educationLevel: string;
  targetGoals: string[];
  learningStreak: number;
  totalXP: number;
  level: number;
  badges: string[];
  completedPaths: string[];
  subscriptionPlan: 'free' | 'premium' | 'enterprise';
  subscriptionExpiry?: Date;
}

export interface IUser extends Document {
  email: string;
  password: string;
  phone?: string;
  phoneVerified: boolean;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  avatar?: string;
  profile: IUserProfile;
  teacherProfile?: ITeacherProfile;
  studentProfile?: IStudentProfile;
  cognitiveLoad: number;
  preferences: Record<string, any>;
  progress: {
    courses: Array<{ courseId: mongoose.Types.ObjectId; completed: boolean; score: number }>;
    currentStreak: number;
    totalTimeSpent: number;
  };
  intent: 'skill_improvement' | 'topic_exploration' | 'certification_preparation' | 'enrollment_readiness' | null;
  onboardingCompleted: boolean;
  isActive: boolean;
  lastLogin: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const teacherProfileSchema = new Schema<ITeacherProfile>({
  qualifications: [String],
  expertise: [String],
  experienceYears: { type: Number, default: 0 },
  hourlyRate: { type: Number, default: 0 },
  totalStudents: { type: Number, default: 0 },
  totalCourses: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  bio: { type: String, default: '' },
  linkedIn: String,
  website: String,
  isVerified: { type: Boolean, default: false },
  featured: { type: Boolean, default: false }
});

const studentProfileSchema = new Schema<IStudentProfile>({
  educationLevel: { type: String, default: '' },
  targetGoals: [String],
  learningStreak: { type: Number, default: 0 },
  totalXP: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  badges: [String],
  completedPaths: [String],
  subscriptionPlan: { type: String, enum: ['free', 'premium', 'enterprise'], default: 'free' },
  subscriptionExpiry: Date
});

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, minlength: 6 },
  phone: { type: String },
  phoneVerified: { type: Boolean, default: false },
  name: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  avatar: { type: String, default: '' },
  profile: {
    grade: { type: String },
    subjectInterests: { type: [String], default: [] },
    weakAreas: { type: [String], default: [] },
    preferredLearningStyle: { 
      type: String, 
      enum: ['video', 'text', 'practice', 'interactive', 'mixed'],
      default: 'mixed'
    },
    learningGoals: { 
      type: [String], 
      enum: ['board_exams', 'jee', 'neet', 'certification', 'skill_improvement', 'knowledge_exploration', 'career'],
      default: []
    },
    currentPerformanceLevel: { 
      type: String, 
      enum: ['below_average', 'average', 'above_average', 'excellent'],
      default: 'average'
    },
    pacePreference: { type: String, enum: ['slow', 'medium', 'fast'], default: 'medium' },
    languagePreference: { type: String, default: 'en' },
    targetExamDate: { type: Date }
  },
  teacherProfile: { 
    type: teacherProfileSchema, 
    default: () => ({
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
    })
  },
  studentProfile: { 
    type: studentProfileSchema, 
    default: () => ({
      educationLevel: '',
      targetGoals: [],
      learningStreak: 0,
      totalXP: 0,
      level: 1,
      badges: [],
      completedPaths: [],
      subscriptionPlan: 'free'
    })
  },
  cognitiveLoad: { type: Number, default: 50 },
  preferences: { type: Schema.Types.Mixed, default: {} },
  progress: {
    courses: [{
      courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
      completed: { type: Boolean, default: false },
      score: { type: Number, default: 0 }
    }],
    currentStreak: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 }
  },
  intent: { 
    type: String, 
    enum: ['skill_improvement', 'topic_exploration', 'certification_preparation', 'enrollment_readiness', null],
    default: null
  },
  onboardingCompleted: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', userSchema);
