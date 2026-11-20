import { Router, Response, NextFunction } from "express";
import { User } from "../models/User";
import { Service } from "../models/Service";
import { Appointment } from "../models/Appointment";
import { Transaction } from "../models/Transaction";
import {
  AuthenticatedRequest,
  requireRole,
  verifyJWT,
} from "../middleware/auth";
import { getUsersMapByIds } from "../utils/userLookup";

const router = Router();

// GET /api/dashboard/customer - Customer dashboard overview stats
router.get(
  "/customer",
  verifyJWT,
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user!.id;

      const [total, pending, confirmed, cancelled, recentAppointments] =
        await Promise.all([
          Appointment.countDocuments({ customerId }),
          Appointment.countDocuments({ customerId, status: "pending" }),
          Appointment.countDocuments({ customerId, status: "confirmed" }),
          Appointment.countDocuments({ customerId, status: "cancelled" }),
          Appointment.find({ customerId })
            .populate("serviceId", "serviceName category image price duration")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        ]);

      res.json({
        success: true,
        data: {
          stats: {
            totalAppointments: total,
            pendingAppointments: pending,
            confirmedAppointments: confirmed,
            cancelledAppointments: cancelled,
          },
          recentAppointments,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/dashboard/admin - Admin dashboard overview stats
router.get(
  "/admin",
  verifyJWT,
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [
        totalCustomers,
        totalActiveServices,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        totalSuccessfulPayments,
        revenueAgg,
        recentAppointments,
      ] = await Promise.all([
        User.countDocuments({ role: { $ne: "admin" } }),
        Service.countDocuments({ status: "active" }),
        Appointment.countDocuments(),
        Appointment.countDocuments({ status: "pending" }),
        Appointment.countDocuments({ status: "confirmed" }),
        Transaction.countDocuments({ status: "paid" }),
        Transaction.aggregate([
          { $match: { status: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Appointment.find()
          .populate("serviceId", "serviceName category image price")
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
      ]);

      const usersMap = await getUsersMapByIds(
        recentAppointments.map((a) => a.customerId)
      );

      const enrichedRecent = recentAppointments.map((apt) => ({
        ...apt,
        customer: usersMap.get(apt.customerId) || {
          id: apt.customerId,
          name: "Unknown Customer",
          email: "",
          image: "",
        },
      }));

      res.json({
        success: true,
        data: {
          stats: {
            totalCustomers,
            totalActiveServices,
            totalAppointments,
            pendingAppointments,
            confirmedAppointments,
            totalSuccessfulPayments,
            totalRevenue: revenueAgg[0]?.total || 0,
          },
          recentAppointments: enrichedRecent,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
