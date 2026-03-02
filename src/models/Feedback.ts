import mongoose, { Document, Schema } from 'mongoose';

export interface IFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  type: 'difficulty' | 'pace' | 'content' | 'general';
  feedback: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  cognitiveLoadAtTime: number;
  recommendationId?: mongoose.Types.ObjectId;
  actionTaken?: string;
  createdAt: Date;
}

const feedbackSchema = new Schema<IFeedback>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  type: { 
    type: String, 
    enum: ['difficulty', 'pace', 'content', 'general'], 
    required: true 
  },
  feedback: { type: String, required: true },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
  cognitiveLoadAtTime: { type: Number, default: 50 },
  recommendationId: { type: Schema.Types.ObjectId, ref: 'Recommendation' },
  actionTaken: { type: String },
  createdAt: { type: Date, default: Date.now }
});

feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ courseId: 1 });

export default mongoose.model<IFeedback>('Feedback', feedbackSchema);
