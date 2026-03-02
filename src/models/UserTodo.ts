import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUserTodo extends Document {
  userId: Types.ObjectId;
  subject: string;
  topicTitle: string;
  completed: boolean;
  order: number;
  createdAt: Date;
  completedAt?: Date;
}

const UserTodoSchema = new Schema<IUserTodo>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true },
  topicTitle: { type: String, required: true },
  completed: { type: Boolean, default: false },
  order: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

UserTodoSchema.index({ userId: 1, subject: 1 });
UserTodoSchema.index({ userId: 1, completed: 1, order: 1 });
UserTodoSchema.index({ userId: 1, topicTitle: 1 }, { unique: true });

export default mongoose.model<IUserTodo>('UserTodo', UserTodoSchema);
