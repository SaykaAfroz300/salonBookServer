import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  role: "customer" | "admin";
  isBlocked: boolean;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: "" },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    isBlocked: { type: Boolean, default: false },
    phone: { type: String, default: "", trim: true },
  },
  {
    collection: "users",
    timestamps: true,
    strict: false,
  }
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
