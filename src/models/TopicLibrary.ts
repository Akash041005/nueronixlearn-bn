import mongoose, { Document, Schema } from 'mongoose';

export interface ITopic extends Document {
  title: string;
  order: number;
}

export interface ITopicLibrary extends Document {
  subject: string;
  normalizedSubject: string;
  topics: ITopic[];
  source: 'hardcoded' | 'ai';
  createdAt: Date;
}

const TopicSchema = new Schema<ITopic>({
  title: { type: String, required: true },
  order: { type: Number, required: true }
});

const TopicLibrarySchema = new Schema<ITopicLibrary>({
  subject: { type: String, required: true },
  normalizedSubject: { type: String, required: true, unique: true },
  topics: [TopicSchema],
  source: { type: String, enum: ['hardcoded', 'ai'], default: 'hardcoded' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ITopicLibrary>('TopicLibrary', TopicLibrarySchema);
