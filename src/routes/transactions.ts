import { Router, Response, NextFunction } from "express";
import { Transaction } from "../models/Transaction";
import {
  AuthenticatedRequest,
  requireRole,
  verifyJWT,
} from "../middleware/auth";
import { getUsersMapByIds } from "../utils/userLookup";

const router = Router();

// GET /api/transactions - Admin only (Read-Only: no manual updates allowed)
router.get(
  "/",
  verifyJWT,
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const transactions = await Transaction.find()
        .populate({
          path: "appointmentId",
          select: "appointmentDate timeSlot status paymentStatus serviceId",
          populate: {
            path: "serviceId",
            select: "serviceName category image price",
          },
        })
        .sort({ createdAt: -1 })
        .lean();

      const customerIds = transactions.map((t) => t.customerId);
      const usersMap = await getUsersMapByIds(customerIds);

      const enriched = transactions.map((tx) => ({
        ...tx,
        customer: usersMap.get(tx.customerId) || {
          id: tx.customerId,
          name: "Unknown Customer",
          email: "",
          image: "",
        },
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

export default router;
