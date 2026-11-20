import { Router, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { Appointment } from "../models/Appointment";
import {
  AuthenticatedRequest,
  requireRole,
  verifyJWT,
} from "../middleware/auth";
import { findUserByIdentifier, serializeUser } from "../utils/userLookup";

const router = Router();

// GET /api/users/me - Authenticated user's own profile
router.get(
  "/me",
  verifyJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: req.user,
    });
  }
);

// PATCH /api/users/me - Update own profile (strictly name, image, phone only)
router.patch(
  "/me",
  verifyJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { name, image, phone } = req.body;
      const updates: Record<string, any> = {};

      if (name !== undefined) {
        const trimmed = String(name).trim();
        if (trimmed.length < 2) {
          res.status(400).json({
            success: false,
            message: "Full name must be at least 2 characters long.",
          });
          return;
        }
        updates.name = trimmed;
      }

      if (image !== undefined) {
        updates.image = String(image).trim();
      }

      if (phone !== undefined) {
        updates.phone = String(phone).trim().slice(0, 30);
      }

      // Explicitly never allow role or isBlocked changes via profile update
      const filterConditions: Record<string, any>[] = [
        { email: req.user!.email },
      ];
      if (mongoose.Types.ObjectId.isValid(req.user!.id)) {
        filterConditions.unshift({
          _id: new mongoose.Types.ObjectId(req.user!.id),
        });
      } else {
        filterConditions.unshift({ id: req.user!.id });
      }

      const updated = await User.findOneAndUpdate(
        { $or: filterConditions },
        { $set: updates },
        { new: true }
      ).lean();

      if (!updated) {
        res.status(404).json({
          success: false,
          message: "User profile not found.",
        });
        return;
      }

      res.json({
        success: true,
        message: "Profile updated successfully.",
        data: serializeUser(updated),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users - Admin only: list all registered customers
router.get(
  "/",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { search, status } = req.query;
      const filter: Record<string, any> = { role: { $ne: "admin" } };

      if (typeof search === "string" && search.trim()) {
        filter.$or = [
          { name: { $regex: search.trim(), $options: "i" } },
          { email: { $regex: search.trim(), $options: "i" } },
        ];
      }
      if (status === "blocked") {
        filter.isBlocked = true;
      } else if (status === "active") {
        filter.isBlocked = { $ne: true };
      }

      const users = await User.find(filter).sort({ createdAt: -1 }).lean();
      const serialized = users.map(serializeUser);

      // Count appointments per customer
      const ids = serialized.map((u) => u.id);
      const counts = await Appointment.aggregate([
        { $match: { customerId: { $in: ids } } },
        { $group: { _id: "$customerId", count: { $sum: 1 } } },
      ]);
      const countMap = new Map<string, number>();
      for (const c of counts) {
        countMap.set(c._id, c.count);
      }

      const enriched = serialized.map((u) => ({
        ...u,
        appointmentCount: countMap.get(u.id) || 0,
      }));

      res.json({
        success: true,
        count: enriched.length,
        data: enriched,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/:id - Admin only: view user details
router.get(
  "/:id",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userDoc = await findUserByIdentifier(String(req.params.id));
      if (!userDoc) {
        res.status(404).json({ success: false, message: "User not found." });
        return;
      }

      const user = serializeUser(userDoc);
      const appointments = await Appointment.find({ customerId: user.id })
        .populate("serviceId", "serviceName category price")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      res.json({
        success: true,
        data: {
          ...user,
          recentAppointments: appointments,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/users/:id/block - Admin only: block or unblock a customer
router.patch(
  "/:id/block",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const targetId = String(req.params.id);
      const { isBlocked } = req.body;

      if (typeof isBlocked !== "boolean") {
        res.status(400).json({
          success: false,
          message: "isBlocked boolean field is required.",
        });
        return;
      }

      const targetDoc = await findUserByIdentifier(targetId);
      if (!targetDoc) {
        res.status(404).json({ success: false, message: "User not found." });
        return;
      }

      const target = serializeUser(targetDoc);
      if (target.id === req.user!.id || target.role === "admin") {
        res.status(400).json({
          success: false,
          message: "Administrator accounts cannot be blocked.",
        });
        return;
      }

      const updated = await User.findByIdAndUpdate(
        targetDoc._id,
        { $set: { isBlocked } },
        { new: true }
      ).lean();

      res.json({
        success: true,
        message: isBlocked
          ? `${target.name} has been blocked.`
          : `${target.name} has been unblocked.`,
        data: serializeUser(updated),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
