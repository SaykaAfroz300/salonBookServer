import mongoose, { Schema, Document, Model } from "mongoose";

export const SERVICE_CATEGORIES = [
  "Haircut & Styling",
  "Hair Coloring",
  "Hair Treatment",
  "Facial & Skincare",
  "Makeup",
  "Manicure & Pedicure",
  "Spa & Massage",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export interface IService extends Document {
  serviceName: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  image: string;
  status: "active" | "inactive";
  createdAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    serviceName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: {
      type: Number,
      required: true,
      min: [0.01, "Price must be a positive number"],
    },
    duration: {
      type: Number,
      required: true,
      min: [1, "Duration must be a positive number"],
    },
    image: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    collection: "services",
    timestamps: { createdAt: true, updatedAt: true },
  }
);

ServiceSchema.index({ serviceName: "text", category: 1, status: 1, price: 1 });

export const Service: Model<IService> =
  (mongoose.models.Service as Model<IService>) ||
  mongoose.model<IService>("Service", ServiceSchema);
