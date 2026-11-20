import { Router, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Appointment, TIME_SLOTS } from "../models/Appointment";
import { Service } from "../models/Service";
import {
  AuthenticatedRequest,
  requireRole,
  verifyJWT,
} from "../middleware/auth";
import { getUsersMapByIds } from "../utils/userLookup";

const router = Router();

// GET /api/appointments/booked-slots?date=YYYY-MM-DD
router.get(
  "/booked-slots",
  verifyJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { date } = req.query;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({
          success: false,
          message: "A valid appointment date (YYYY-MM-DD) is required.",
        });
        return;
      }

      const activeAppointments = await Appointment.find({
        appointmentDate: date,
        status: { $in: ["pending", "confirmed"] },
      })
        .select("timeSlot")
        .lean();

      const bookedSlots = activeAppointments.map((a) => a.timeSlot);
      res.json({
        success: true,
        data: {
          allSlots: TIME_SLOTS,
          bookedSlots,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/appointments - Customer only: submit appointment request
router.post(
  "/",
  verifyJWT,
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { serviceId, appointmentDate, timeSlot, message } = req.body;

      if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        res.status(400).json({
          success: false,
          message: "A valid salon service ID is required.",
        });
        return;
      }

      if (
        typeof appointmentDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
      ) {
        res.status(400).json({
          success: false,
          message: "Please select a valid appointment date (YYYY-MM-DD).",
        });
        return;
      }

      // Prevent booking dates in the past (comparing YYYY-MM-DD in local/UTC safe way)
      const todayStr = new Date().toISOString().split("T")[0];
      if (appointmentDate < todayStr) {
        res.status(400).json({
          success: false,
          message: "Appointment date cannot be in the past.",
        });
        return;
      }

      if (
        typeof timeSlot !== "string" ||
        !(TIME_SLOTS as readonly string[]).includes(timeSlot)
      ) {
        res.status(400).json({
          success: false,
          message: "Please select a valid time slot.",
        });
        return;
      }

      const service = await Service.findById(serviceId).lean();
      if (!service) {
        res.status(404).json({
          success: false,
          message: "Selected salon service was not found.",
        });
        return;
      }

      if (service.status !== "active") {
        res.status(400).json({
          success: false,
          message:
            "This service is currently inactive and unavailable for booking.",
        });
        return;
      }

      // Prevent duplicate active appointments for the same date and time slot
      const existingConflict = await Appointment.findOne({
        appointmentDate,
        timeSlot,
        status: { $in: ["pending", "confirmed"] },
      }).lean();

      if (existingConflict) {
        res.status(409).json({
          success: false,
          message: `The ${timeSlot} slot on ${appointmentDate} is already booked. Please choose another time slot.`,
        });
        return;
      }

      const appointment = await Appointment.create({
        serviceId: service._id,
        customerId: req.user!.id,
        appointmentDate,
        timeSlot,
        message: typeof message === "string" ? message.trim().slice(0, 500) : "",
        servicePrice: service.price,
        paymentStatus: "unpaid",
        status: "pending",
      });

      const populated = await Appointment.findById(appointment._id)
        .populate("serviceId", "serviceName category image price duration status")
        .lean();

      res.status(201).json({
        success: true,
        message: "Appointment request submitted successfully!",
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/appointments/my - Customer only: view own appointments
router.get(
  "/my",
  verifyJWT,
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const appointments = await Appointment.find({
        customerId: req.user!.id,
      })
        .populate("serviceId", "serviceName category image price duration status")
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        count: appointments.length,
        data: appointments,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/appointments/:id/cancel - Customer only: cancel own pending appointment
router.patch(
  "/:id/cancel",
  verifyJWT,
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
        return;
      }

      const appointment = await Appointment.findById(id);
      if (!appointment) {
        res.status(404).json({
          success: false,
          message: "Appointment not found.",
        });
        return;
      }

      if (appointment.customerId !== req.user!.id) {
        res.status(403).json({
          success: false,
          message: "You can only cancel your own appointment requests.",
        });
        return;
      }

      if (appointment.status !== "pending") {
        res.status(400).json({
          success: false,
          message: `Cannot cancel an appointment that is already ${appointment.status}.`,
        });
        return;
      }

      appointment.status = "cancelled";
      await appointment.save();

      res.json({
        success: true,
        message: "Appointment request cancelled successfully.",
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/appointments - Admin only: view all appointments with customer & service info
router.get(
  "/",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status, paymentStatus } = req.query;
      const filter: Record<string, any> = {};

      if (status === "pending" || status === "confirmed" || status === "cancelled") {
        filter.status = status;
      }
      if (paymentStatus === "paid" || paymentStatus === "unpaid") {
        filter.paymentStatus = paymentStatus;
      }

      const appointments = await Appointment.find(filter)
        .populate("serviceId", "serviceName category image price duration status")
        .sort({ createdAt: -1 })
        .lean();

      const customerIds = appointments.map((a) => a.customerId);
      const usersMap = await getUsersMapByIds(customerIds);

      const enriched = appointments.map((apt) => ({
        ...apt,
        customer: usersMap.get(apt.customerId) || {
          id: apt.customerId,
          name: "Unknown Customer",
          email: "",
          image: "",
          phone: "",
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

// PATCH /api/appointments/:id/status - Admin only: confirm pending or cancel pending/confirmed
router.patch(
  "/:id/status",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
        return;
      }

      if (status !== "confirmed" && status !== "cancelled") {
        res.status(400).json({
          success: false,
          message: "Status must be either 'confirmed' or 'cancelled'.",
        });
        return;
      }

      const appointment = await Appointment.findById(id);
      if (!appointment) {
        res.status(404).json({
          success: false,
          message: "Appointment not found.",
        });
        return;
      }

      if (status === "confirmed") {
        if (appointment.status !== "pending") {
          res.status(400).json({
            success: false,
            message: "Only pending appointments can be confirmed.",
          });
          return;
        }
      }

      if (status === "cancelled") {
        if (appointment.status === "cancelled") {
          res.status(400).json({
            success: false,
            message: "This appointment is already cancelled.",
          });
          return;
        }
        if (appointment.paymentStatus === "paid") {
          res.status(400).json({
            success: false,
            message: "Cannot cancel an appointment that has already been paid.",
          });
          return;
        }
      }

      appointment.status = status;
      await appointment.save();

      const populated = await Appointment.findById(appointment._id)
        .populate("serviceId", "serviceName category image price duration status")
        .lean();

      res.json({
        success: true,
        message: `Appointment ${status} successfully.`,
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
