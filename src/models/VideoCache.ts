import mongoose, { Document, Schema } from 'mongoose';

export interface IVideoCache extends Document {
  userId: mongoose.Types.ObjectId;
  subject: string;
  topic: string;
  subtopic?: string;
  videoUrl: string;
  script?: {
    intro: string;
    mainContent: string;
    example: string;
    summary: string;
  };
  imageUrls: string[];
  createdAt: Date;
  expiresAt: Date;
}

const videoCacheSchema = new Schema<IVideoCache>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  subtopic: { type: String },
  videoUrl: { type: String, required: true },
  script: {
    intro: String,
    mainContent: String,
    example: String,
    summary: String
  },
  imageUrls: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
});

videoCacheSchema.index({ userId: 1, subject: 1, topic: 1, subtopic: 1 });

export default mongoose.model<IVideoCache>('VideoCache', videoCacheSchema);
