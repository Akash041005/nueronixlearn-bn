import mongoose, { Document, Schema } from 'mongoose';

export interface IUserBehavior extends Document {
  userId: mongoose.Types.ObjectId;
  chatTone: 'formal' | 'casual' | 'friendly' | 'motivational' | 'strict';
  preferredResponseLength: 'short' | 'medium' | 'long';
  topicsOfInterest: string[];
  emotionalState: 'neutral' | 'motivated' | 'frustrated' | 'confident' | 'anxious';
  interactionPatterns: {
    totalChats: number;
    questionsAsked: number;
    topicsDiscussed: string[];
    avgSessionLength: number;
    lastActive: Date;
  };
  lastAnalyzed: Date;
  analysisHistory: Array<{
    date: Date;
    tone: string;
    emotionalState: string;
    summary: string;
  }>;
}

const userBehaviorSchema = new Schema<IUserBehavior>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  chatTone: { type: String, default: 'friendly' },
  preferredResponseLength: { type: String, default: 'medium' },
  topicsOfInterest: [String],
  emotionalState: { type: String, default: 'neutral' },
  interactionPatterns: {
    totalChats: { type: Number, default: 0 },
    questionsAsked: { type: Number, default: 0 },
    topicsDiscussed: [String],
    avgSessionLength: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  },
  lastAnalyzed: { type: Date, default: Date.now },
  analysisHistory: [{
    date: Date,
    tone: String,
    emotionalState: String,
    summary: String
  }]
});

const UserBehavior = mongoose.model<IUserBehavior>('UserBehavior', userBehaviorSchema);

export default UserBehavior;
