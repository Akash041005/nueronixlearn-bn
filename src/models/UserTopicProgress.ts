import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUserTopicProgress extends Document {
  userId: Types.ObjectId;
  subject: string;
  topicTitle: string;
  subtopicTitle?: string;
  order: number;
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
}

const UserTopicProgressSchema = new Schema<IUserTopicProgress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true, index: true },
  topicTitle: { type: String, required: true },
  subtopicTitle: { type: String },
  order: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

UserTopicProgressSchema.index({ userId: 1, subject: 1 });
UserTopicProgressSchema.index({ userId: 1, subject: 1, topicTitle: 1 });
UserTopicProgressSchema.index({ userId: 1, subject: 1, completed: 1, order: 1 });
UserTopicProgressSchema.index({ userId: 1, subject: 1, topicTitle: 1, subtopicTitle: 1 }, { unique: true });

export default mongoose.model<IUserTopicProgress>('UserTopicProgress', UserTopicProgressSchema);
