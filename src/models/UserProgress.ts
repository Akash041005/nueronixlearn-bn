import mongoose, { Document, Schema } from 'mongoose';

export interface IUserProgress extends Document {
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  completedModules: mongoose.Types.ObjectId[];
  currentModule: mongoose.Types.ObjectId;
  assessmentScores: Array<{
    assessmentId: mongoose.Types.ObjectId;
    score: number;
    attempts: number;
    lastAttempt: Date;
  }>;
  timeSpent: number;
  lastAccessed: Date;
  cognitiveLoadHistory: Array<{
    timestamp: Date;
    loadLevel: number;
  }>;
  conceptMastery: Record<string, number>;
}

const userProgressSchema = new Schema<IUserProgress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  completedModules: [{ type: Schema.Types.ObjectId }],
  currentModule: { type: Schema.Types.ObjectId },
  assessmentScores: [{
    assessmentId: { type: Schema.Types.ObjectId },
    score: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    lastAttempt: { type: Date, default: Date.now }
  }],
  timeSpent: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now },
  cognitiveLoadHistory: [{
    timestamp: { type: Date, default: Date.now },
    loadLevel: { type: Number, default: 50 }
  }],
  conceptMastery: { type: Schema.Types.Mixed, default: {} }
});

userProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.model<IUserProgress>('UserProgress', userProgressSchema);
