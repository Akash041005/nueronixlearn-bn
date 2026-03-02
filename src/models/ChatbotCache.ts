import mongoose, { Document, Schema } from 'mongoose';

export interface IChatbotCache extends Document {
  questionText: string;
  normalizedQuestion: string;
  answer: string;
  source: 'ai' | 'hardcoded';
  createdAt: Date;
}

const ChatbotCacheSchema = new Schema<IChatbotCache>({
  questionText: { type: String, required: true },
  normalizedQuestion: { type: String, required: true, unique: true },
  answer: { type: String, required: true },
  source: { type: String, enum: ['ai', 'hardcoded'], default: 'ai' },
  createdAt: { type: Date, default: Date.now }
});

ChatbotCacheSchema.index({ createdAt: 1 });

export default mongoose.model<IChatbotCache>('ChatbotCache', ChatbotCacheSchema);
