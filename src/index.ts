import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import servicesRouter from "./routes/services";
import appointmentsRouter from "./routes/appointments";
import paymentsRouter, { stripeWebhookHandler } from "./routes/payments";
import transactionsRouter from "./routes/transactions";
import usersRouter from "./routes/users";
import dashboardRouter from "./routes/dashboard";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

// Build allowed origins list from CLIENT_URL (supports comma-separated URLs)
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Stripe webhooks, curl, health checks)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, "");
      if (
        allowedOrigins.includes(cleanOrigin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
  })
);

// Ensure database is connected before handling API requests
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// Stripe webhook MUST receive raw body before express.json()
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// Standard JSON & URL-encoded body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoints
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    name: "SalonBook API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Feature routes
app.use("/api/services", servicesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

// Start HTTP server when not running in Vercel serverless environment
if (process.env.VERCEL !== "1") {
  connectDB()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`SalonBook server listening on http://localhost:${PORT}`);
      });

      const shutdown = () => {
        server.close(() => {
          process.exit(0);
        });
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    })
    .catch((err) => {
      console.error("Failed to start SalonBook server:", err);
      process.exit(1);
    });
}

export default app;
