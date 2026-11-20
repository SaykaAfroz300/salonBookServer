import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import { getStripe } from "../config/stripe";
import { Appointment } from "../models/Appointment";
import { Transaction } from "../models/Transaction";
import {
  AuthenticatedRequest,
  requireRole,
  verifyJWT,
} from "../middleware/auth";

const router = Router();

// POST /api/payments/create-checkout-session - Customer only
router.post(
  "/create-checkout-session",
  verifyJWT,
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { appointmentId } = req.body;
      if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
        res.status(400).json({
          success: false,
          message: "A valid appointment ID is required.",
        });
        return;
      }

      const appointment = await Appointment.findById(appointmentId)
        .populate("serviceId", "serviceName category image description")
        .lean();

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
          message: "You can only pay for your own appointments.",
        });
        return;
      }

      if (appointment.status !== "confirmed") {
        res.status(400).json({
          success: false,
          message:
            "Payment is only allowed for confirmed appointments. Please wait for admin confirmation.",
        });
        return;
      }

      if (appointment.paymentStatus === "paid") {
        res.status(400).json({
          success: false,
          message: "This appointment has already been paid.",
        });
        return;
      }

      const stripe = getStripe();
      const clientUrl = (
        process.env.CLIENT_URL || "http://localhost:3000"
      ).replace(/\/$/, "");
      const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
      const serviceInfo = appointment.serviceId as any;
      const serviceName = serviceInfo?.serviceName || "Salon Service";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: req.user!.email,
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: serviceName,
                description: `SalonBook Appointment on ${appointment.appointmentDate} at ${appointment.timeSlot}`,
                images:
                  serviceInfo?.image &&
                  /^https?:\/\//i.test(serviceInfo.image)
                    ? [serviceInfo.image]
                    : undefined,
              },
              unit_amount: Math.round(appointment.servicePrice * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          appointmentId: appointment._id.toString(),
          customerId: req.user!.id,
        },
        success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/payment/cancel?appointment_id=${appointment._id.toString()}`,
      });

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          url: session.url,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/payments/session/:sessionId - Read-only lookup for Payment Success page
// NOTE: Does NOT update payment status. Payment status is updated ONLY via verified Stripe webhook.
router.get(
  "/session/:sessionId",
  verifyJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = String(req.params.sessionId);
      const transaction = await Transaction.findOne({
        stripeSessionId: sessionId,
      })
        .populate({
          path: "appointmentId",
          populate: {
            path: "serviceId",
            select: "serviceName category image price duration",
          },
        })
        .lean();

      if (transaction) {
        if (
          req.user!.role !== "admin" &&
          transaction.customerId !== req.user!.id
        ) {
          res.status(403).json({
            success: false,
            message: "Access denied.",
          });
          return;
        }

        res.json({
          success: true,
          data: {
            verified: transaction.status === "paid",
            transaction,
          },
        });
        return;
      }

      // Webhook may still be in flight for a second or two
      res.json({
        success: true,
        data: {
          verified: false,
          pendingWebhook: true,
          transaction: null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/payments/webhook - Verified Stripe Webhook Handler (mounted with express.raw)
export async function stripeWebhookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    res.status(400).send("Missing Stripe signature or webhook secret.");
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const appointmentId = session.metadata?.appointmentId;
      const customerId = session.metadata?.customerId;

      if (
        appointmentId &&
        customerId &&
        mongoose.Types.ObjectId.isValid(appointmentId) &&
        session.payment_status === "paid"
      ) {
        const appointment = await Appointment.findById(appointmentId);
        if (appointment && appointment.status === "confirmed") {
          appointment.paymentStatus = "paid";
          await appointment.save();

          await Transaction.findOneAndUpdate(
            { stripeSessionId: session.id },
            {
              appointmentId: appointment._id,
              customerId,
              amount: (session.amount_total || 0) / 100,
              currency: (session.currency || "usd").toLowerCase(),
              stripeSessionId: session.id,
              status: "paid",
            },
            { upsert: true, new: true }
          );
        }
      }
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const appointmentId = session.metadata?.appointmentId;
      const customerId = session.metadata?.customerId;

      if (
        appointmentId &&
        customerId &&
        mongoose.Types.ObjectId.isValid(appointmentId)
      ) {
        await Transaction.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            appointmentId: new mongoose.Types.ObjectId(appointmentId),
            customerId,
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || "usd").toLowerCase(),
            stripeSessionId: session.id,
            status: "failed",
          },
          { upsert: true, new: true }
        );
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook event:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

export default router;
