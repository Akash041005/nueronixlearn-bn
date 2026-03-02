import mongoose, { Document, Schema } from 'mongoose';

export interface IDiaryEntry extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  title: string;
  content: string;
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  tags: string[];
  courseId?: mongoose.Types.ObjectId;
  moduleId?: mongoose.Types.ObjectId;
  goalsCompleted: string[];
  goalsMissed: string[];
  nextDayGoals: string[];
  reflections: string;
  isPrivate: boolean;
  attachments?: Array<{ name: string; url: string; type: string }>;
}

export interface IDiaryPassword extends Document {
  userId: mongoose.Types.ObjectId;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  lastVerified: Date;
}

const diaryEntrySchema = new Schema<IDiaryEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  mood: { type: String, enum: ['great', 'good', 'okay', 'bad', 'terrible'] },
  tags: [String],
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  moduleId: { type: Schema.Types.ObjectId },
  goalsCompleted: [String],
  goalsMissed: [String],
  nextDayGoals: [String],
  reflections: String,
  isPrivate: { type: Boolean, default: true },
  attachments: [{
    name: String,
    url: String,
    type: String
  }]
}, { timestamps: true });

diaryEntrySchema.index({ userId: 1, date: -1 });

const diaryPasswordSchema = new Schema<IDiaryPassword>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastVerified: { type: Date, default: Date.now }
});

export const DiaryEntry = mongoose.model<IDiaryEntry>('DiaryEntry', diaryEntrySchema);
export const DiaryPassword = mongoose.model<IDiaryPassword>('DiaryPassword', diaryPasswordSchema);
