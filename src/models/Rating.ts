import mongoose, { Document, Schema } from 'mongoose';

export interface IRating extends Document {
  teacherId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  rating: number;
  review?: string;
  categories: {
    teachingQuality: number;
    courseContent: number;
    responsiveness: number;
    expertise: number;
  };
  isVerifiedPurchase: boolean;
  helpful: number;
  reportCount: number;
  status: 'visible' | 'hidden' | 'reported';
}

const ratingSchema = new Schema<IRating>({
  teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: String,
  categories: {
    teachingQuality: { type: Number, min: 1, max: 5 },
    courseContent: { type: Number, min: 1, max: 5 },
    responsiveness: { type: Number, min: 1, max: 5 },
    expertise: { type: Number, min: 1, max: 5 }
  },
  isVerifiedPurchase: { type: Boolean, default: false },
  helpful: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  status: { type: String, enum: ['visible', 'hidden', 'reported'], default: 'visible' }
}, { timestamps: true });

ratingSchema.index({ teacherId: 1, studentId: 1 }, { unique: true });
ratingSchema.index({ teacherId: 1, createdAt: -1 });

export default mongoose.model<IRating>('Rating', ratingSchema);
