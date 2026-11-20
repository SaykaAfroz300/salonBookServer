import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITransaction extends Document {
  appointmentId: Types.ObjectId;
  customerId: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  status: "paid" | "failed";
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      default: "usd",
    },
    stripeSessionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["paid", "failed"],
      required: true,
    },
  },
  {
    collection: "transactions",
    timestamps: { createdAt: true, updatedAt: true },
  }
);

export const Transaction =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);
