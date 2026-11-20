import mongoose from "mongoose";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  try {
    const conn = await mongoose.connect(uri, {
      bufferCommands: false,
    });
    isConnected = conn.connection.readyState === 1;
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    isConnected = false;
    console.error("MongoDB connection error:", error);
    throw error;
  }
}
