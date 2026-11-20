import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { findUserByIdentifier, PublicUser, serializeUser } from "../utils/userLookup";

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  role?: "customer" | "admin";
}

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

export async function verifyJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Missing or malformed Bearer token.",
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
      return;
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, secret) as JwtPayload;
    } catch {
      res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
      return;
    }

    const dbUser = await findUserByIdentifier(decoded.sub, decoded.email);
    if (!dbUser) {
      res.status(401).json({
        success: false,
        message: "User account not found.",
      });
      return;
    }

    const user = serializeUser(dbUser);
    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message:
          "Your account has been blocked by an administrator. You cannot access protected features.",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Array<"customer" | "admin">) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission for this action.",
      });
      return;
    }

    next();
  };
}
