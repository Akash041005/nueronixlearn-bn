import mongoose, { Document, Schema } from 'mongoose';

export interface ISessionLog extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  pagesVisited: string[];
  actions: Array<{
    type: string;
    timestamp: Date;
    data?: Record<string, any>;
  }>;
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
  };
  ipAddress?: string;
  duration?: number;
  lastActivity: Date;
}

const sessionLogSchema = new Schema<ISessionLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, unique: true },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  pagesVisited: [String],
  actions: [{
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    data: { type: Schema.Types.Mixed }
  }],
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  ipAddress: String,
  duration: { type: Number },
  lastActivity: { type: Date, default: Date.now }
});

sessionLogSchema.index({ userId: 1, startTime: -1 });
sessionLogSchema.index({ sessionId: 1 });

export default mongoose.model<ISessionLog>('SessionLog', sessionLogSchema);
