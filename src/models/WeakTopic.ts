import mongoose, { Document, Schema } from 'mongoose';

export interface IWeakTopic extends Document {
  userId: mongoose.Types.ObjectId;
  topicName: string;
  subject: string;
  youtubeVideoId?: string;
  youtubeVideoTitle?: string;
  completed: boolean;
  completedAt?: Date;
  source: 'chatbot' | 'manual' | 'exam_analysis' | 'onboarding';
  createdAt: Date;
}

const weakTopicSchema = new Schema<IWeakTopic>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  topicName: { type: String, required: true },
  subject: { type: String, required: true },
  youtubeVideoId: String,
  youtubeVideoTitle: String,
  completed: { type: Boolean, default: false },
  completedAt: Date,
  source: { type: String, enum: ['chatbot', 'manual', 'exam_analysis', 'onboarding'], default: 'manual' },
  createdAt: { type: Date, default: Date.now }
});

weakTopicSchema.index({ userId: 1, subject: 1 });

const WeakTopic = mongoose.model<IWeakTopic>('WeakTopic', weakTopicSchema);

export default WeakTopic;
