import mongoose, { Document, Schema } from 'mongoose';

export interface ISubtopic {
  title: string;
  order: number;
}

export interface ITopic {
  title: string;
  order: number;
  subtopics: ISubtopic[];
}

export interface IRoadmap extends Document {
  subject: string;
  topics: ITopic[];
  source: 'hardcoded' | 'ai';
  createdAt: Date;
  updatedAt: Date;
}

const SubtopicSchema = new Schema<ISubtopic>({
  title: { type: String, required: true },
  order: { type: Number, required: true }
});

const TopicSchema = new Schema<ITopic>({
  title: { type: String, required: true },
  order: { type: Number, required: true },
  subtopics: [SubtopicSchema]
});

const RoadmapSchema = new Schema<IRoadmap>(
  {
    subject: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    topics: [TopicSchema],

    source: {
      type: String,
      enum: ['hardcoded', 'ai'],
      default: 'ai'
    }
  },
  {
    timestamps: true
  }
);

// ensure only one roadmap per subject
RoadmapSchema.index({ subject: 1 }, { unique: true });

export default mongoose.model<IRoadmap>('Roadmap', RoadmapSchema);