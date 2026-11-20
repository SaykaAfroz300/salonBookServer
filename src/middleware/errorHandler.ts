import { Request, Response, NextFunction } from "express";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("API Error:", err);

  if (err?.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map(
      (e: any) => e.message
    );
    res.status(400).json({
      success: false,
      message: messages[0] || "Validation failed.",
      errors: messages,
    });
    return;
  }

  if (err?.name === "CastError") {
    res.status(400).json({
      success: false,
      message: "Invalid resource identifier.",
    });
    return;
  }

  const statusCode = err?.statusCode || err?.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err?.message || "Internal server error.",
  });
}
