import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin extends Document {
  username: string;
  password: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: {
    manageUsers: boolean;
    manageCourses: boolean;
    manageExams: boolean;
    manageAdmins: boolean;
    viewAnalytics: boolean;
    manageContent: boolean;
  };
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const adminSchema = new Schema<IAdmin>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  isSuperAdmin: { type: Boolean, default: false },
  permissions: {
    manageUsers: { type: Boolean, default: false },
    manageCourses: { type: Boolean, default: false },
    manageExams: { type: Boolean, default: false },
    manageAdmins: { type: Boolean, default: false },
    viewAnalytics: { type: Boolean, default: false },
    manageContent: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IAdmin>('Admin', adminSchema);
