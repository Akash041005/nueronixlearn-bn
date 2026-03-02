import mongoose, { Document, Schema } from 'mongoose';

export interface IRecommendation extends Document {
  userId: mongoose.Types.ObjectId;
  intent: 'skill_improvement' | 'topic_exploration' | 'certification_preparation' | 'enrollment_readiness';
  recommendedCourses: Array<{
    courseId: mongoose.Types.ObjectId;
    title: string;
    reason: string;
  }>;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedCompletionTime: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'adaptive';
  reasoning: string;
  nextSteps: string[];
  cognitiveLoadAtTime: number;
  feedbackHistory: Array<{
    feedback: string;
    timestamp: Date;
    adjustedRecommendation: boolean;
  }>;
  generatedAt: Date;
  expiresAt: Date;
}

const recommendationSchema = new Schema<IRecommendation>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  intent: { 
    type: String, 
    enum: ['skill_improvement', 'topic_exploration', 'certification_preparation', 'enrollment_readiness'],
    required: true 
  },
  recommendedCourses: [{
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    title: { type: String },
    reason: { type: String }
  }],
  priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  estimatedCompletionTime: { type: String, default: '4 weeks' },
  difficultyLevel: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced', 'adaptive'],
    default: 'intermediate'
  },
  reasoning: { type: String, default: '' },
  nextSteps: [String],
  cognitiveLoadAtTime: { type: Number, default: 50 },
  feedbackHistory: [{
    feedback: String,
    timestamp: { type: Date, default: Date.now },
    adjustedRecommendation: { type: Boolean, default: false }
  }],
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
});

recommendationSchema.index({ userId: 1, generatedAt: -1 });
recommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRecommendation>('Recommendation', recommendationSchema);
