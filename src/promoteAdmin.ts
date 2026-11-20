import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { User } from "./models/User";

async function promoteAdmin() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run promote-admin -- <user-email>");
    process.exit(1);
  }

  try {
    await connectDB();
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: { role: "admin", isBlocked: false } },
      { new: true }
    ).lean();

    if (!updated) {
      console.error(
        `No user found with email "${email}". Register the account first via Sign Up, then run this script.`
      );
      process.exitCode = 1;
    } else {
      console.log(`Successfully promoted "${email}" to Admin role.`);
    }
  } catch (error) {
    console.error("Promote admin error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

promoteAdmin();
