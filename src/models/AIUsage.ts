import mongoose, { Document, Schema } from 'mongoose';

export interface IAIUsage extends Document {
  date: string; // YYYY-MM-DD format
  chatbotCalls: number;
  recommendationCalls: number;
  topicGenerationCalls: number;
  totalTokens: number;
  lastUpdated: Date;
}

const AIUsageSchema = new Schema<IAIUsage>({
  date: { type: String, required: true, unique: true },
  chatbotCalls: { type: Number, default: 0 },
  recommendationCalls: { type: Number, default: 0 },
  topicGenerationCalls: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model<IAIUsage>('AIUsage', AIUsageSchema);
