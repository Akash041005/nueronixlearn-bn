import mongoose, { Document, Schema } from 'mongoose';

export interface IVideoRecommendation {
  title: string;
  url?: string;
  thumbnail?: string;
  duration: string;
  channelName?: string;
}

export interface IRecommendationCache extends Document {
  topicName: string;
  subject: string;
  videos: IVideoRecommendation[];
  createdAt: Date;
}

const RecommendationCacheSchema = new Schema<IRecommendationCache>({
  topicName: { type: String, required: true },
  subject: { type: String, required: true },
  videos: [{
    title: { type: String, required: true },
    url: { type: String, required: true },
    thumbnail: { type: String },
    duration: { type: String },
    channelName: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

RecommendationCacheSchema.index({ topicName: 1, subject: 1 }, { unique: true });
RecommendationCacheSchema.index({ createdAt: 1 });

export default mongoose.model<IRecommendationCache>('RecommendationCache', RecommendationCacheSchema);
