import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubject extends Document {
  userId: Types.ObjectId;
  subject: string;
  createdAt: Date;
}

const SubjectSchema = new Schema<ISubject>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

SubjectSchema.index({ userId: 1, subject: 1 }, { unique: true });

export default mongoose.model<ISubject>('Subject', SubjectSchema);
