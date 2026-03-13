import mongoose, { Document, Schema } from 'mongoose';

export interface IUserLearningBehavior extends Document {
  userId: mongoose.Types.ObjectId;
  subject: string;
  topic: string;
  timeSpent: number;
  quizScore: number;
  attempts: number;
  completed: boolean;
  lastStudied: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userLearningBehaviorSchema = new Schema<IUserLearningBehavior>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  timeSpent: { type: Number, default: 0 },
  quizScore: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  lastStudied: { type: Date, default: Date.now }
}, { timestamps: true });

userLearningBehaviorSchema.index({ userId: 1, subject: 1, topic: 1 });

export default mongoose.model<IUserLearningBehavior>('UserLearningBehavior', userLearningBehaviorSchema);
