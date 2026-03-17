import mongoose, { Document, Schema } from 'mongoose';

export interface ILearningProfile extends Document {
  userId: mongoose.Types.ObjectId;
  learningPace: 'slow' | 'medium' | 'fast';
  experienceLevel: 'beginner' | 'intermediate' | 'professional';
  subjects: string[];
  strongTopics: string[];
  weakTopics: string[];
  completedTopics: string[];
  recommendedTopics: string[];
  createdAt: Date;
  updatedAt: Date;
}

const learningProfileSchema = new Schema<ILearningProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  learningPace: { 
    type: String, 
    enum: ['slow', 'medium', 'fast'], 
    default: 'medium' 
  },
  experienceLevel: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'professional'], 
    default: 'beginner' 
  },
  subjects: [{ type: String }],
  strongTopics: [{ type: String }],
  weakTopics: [{ type: String }],
  completedTopics: [{ type: String }],
  recommendedTopics: [{ type: String }]
}, { timestamps: true });

learningProfileSchema.index({ userId: 1 });

export default mongoose.model<ILearningProfile>('LearningProfile', learningProfileSchema);
