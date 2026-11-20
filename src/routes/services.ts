import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Service, SERVICE_CATEGORIES } from "../models/Service";
import {
  AuthenticatedRequest,
  requireRole,
  verifyJWT,
} from "../middleware/auth";

const router = Router();

// GET /api/services - Public: list active services with search, category filter, and price sorting
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, category, sort, limit } = req.query;
    const filter: Record<string, any> = { status: "active" };

    if (typeof search === "string" && search.trim()) {
      filter.serviceName = { $regex: search.trim(), $options: "i" };
    }

    if (
      typeof category === "string" &&
      category.trim() &&
      category.trim().toLowerCase() !== "all"
    ) {
      filter.category = category.trim();
    }

    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === "price_asc") {
      sortOption = { price: 1 };
    } else if (sort === "price_desc") {
      sortOption = { price: -1 };
    } else if (sort === "duration_asc") {
      sortOption = { duration: 1 };
    }

    let query = Service.find(filter).sort(sortOption);
    const parsedLimit = Number(limit);
    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      query = query.limit(parsedLimit);
    }

    const services = await query.lean();
    res.json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/services/categories - Public: list categories with active service counts
router.get(
  "/categories",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const counts = await Service.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]);

      const countMap = new Map<string, number>();
      for (const item of counts) {
        countMap.set(item._id, item.count);
      }

      const categories = SERVICE_CATEGORIES.map((name) => ({
        name,
        count: countMap.get(name) || 0,
      }));

      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/services/admin/all - Admin: list all services (active + inactive)
router.get(
  "/admin/all",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { search, category, status, sort } = req.query;
      const filter: Record<string, any> = {};

      if (typeof search === "string" && search.trim()) {
        filter.serviceName = { $regex: search.trim(), $options: "i" };
      }
      if (
        typeof category === "string" &&
        category.trim() &&
        category.trim().toLowerCase() !== "all"
      ) {
        filter.category = category.trim();
      }
      if (status === "active" || status === "inactive") {
        filter.status = status;
      }

      let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
      if (sort === "price_asc") sortOption = { price: 1 };
      if (sort === "price_desc") sortOption = { price: -1 };

      const services = await Service.find(filter).sort(sortOption).lean();
      res.json({ success: true, count: services.length, data: services });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/services/:id - Get single service details
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({
        success: false,
        message: "Invalid service ID. The requested salon service does not exist.",
      });
      return;
    }

    const service = await Service.findById(id).lean();
    if (!service) {
      res.status(404).json({
        success: false,
        message: "Salon service not found.",
      });
      return;
    }

    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

// POST /api/services - Admin: create a new salon service
router.post(
  "/",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { serviceName, category, description, price, duration, image, status } =
        req.body;

      if (!serviceName?.trim() || !category?.trim() || !description?.trim() || !image?.trim()) {
        res.status(400).json({
          success: false,
          message:
            "Service name, category, description, and service image are required.",
        });
        return;
      }

      const parsedPrice = Number(price);
      const parsedDuration = Number(duration);

      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        res.status(400).json({
          success: false,
          message: "Price must be a positive number.",
        });
        return;
      }

      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        res.status(400).json({
          success: false,
          message: "Estimated duration must be a positive number of minutes.",
        });
        return;
      }

      const service = await Service.create({
        serviceName: serviceName.trim(),
        category: category.trim(),
        description: description.trim(),
        price: parsedPrice,
        duration: Math.round(parsedDuration),
        image: image.trim(),
        status: status === "inactive" ? "inactive" : "active",
      });

      res.status(201).json({
        success: true,
        message: "Salon service created successfully.",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/services/:id - Admin: update service details or status
router.patch(
  "/:id",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID." });
        return;
      }

      const updates: Record<string, any> = {};
      const { serviceName, category, description, price, duration, image, status } =
        req.body;

      if (serviceName !== undefined) {
        if (!String(serviceName).trim()) {
          res.status(400).json({ success: false, message: "Service name cannot be empty." });
          return;
        }
        updates.serviceName = String(serviceName).trim();
      }
      if (category !== undefined) updates.category = String(category).trim();
      if (description !== undefined) updates.description = String(description).trim();
      if (image !== undefined) updates.image = String(image).trim();

      if (price !== undefined) {
        const parsedPrice = Number(price);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
          res.status(400).json({
            success: false,
            message: "Price must be a positive number.",
          });
          return;
        }
        updates.price = parsedPrice;
      }

      if (duration !== undefined) {
        const parsedDuration = Number(duration);
        if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
          res.status(400).json({
            success: false,
            message: "Estimated duration must be a positive number of minutes.",
          });
          return;
        }
        updates.duration = Math.round(parsedDuration);
      }

      if (status !== undefined) {
        if (status !== "active" && status !== "inactive") {
          res.status(400).json({
            success: false,
            message: "Status must be either 'active' or 'inactive'.",
          });
          return;
        }
        updates.status = status;
      }

      const updated = await Service.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: "Service not found." });
        return;
      }

      res.json({
        success: true,
        message: "Salon service updated successfully.",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/services/:id - Admin: delete a service
router.delete(
  "/:id",
  verifyJWT,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID." });
        return;
      }

      const deleted = await Service.findByIdAndDelete(id);
      if (!deleted) {
        res.status(404).json({ success: false, message: "Service not found." });
        return;
      }

      res.json({
        success: true,
        message: "Salon service deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
