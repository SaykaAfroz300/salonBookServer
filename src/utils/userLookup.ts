import mongoose from "mongoose";
import { User } from "../models/User";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  image: string;
  role: "customer" | "admin";
  isBlocked: boolean;
  phone: string;
  createdAt?: Date;
}

export function serializeUser(doc: any): PublicUser {
  const id = doc.id || doc._id?.toString() || "";
  return {
    id,
    name: doc.name || "",
    email: doc.email || "",
    image: doc.image || "",
    role: doc.role === "admin" ? "admin" : "customer",
    isBlocked: Boolean(doc.isBlocked),
    phone: doc.phone || "",
    createdAt: doc.createdAt,
  };
}

export async function findUserByIdentifier(
  id?: string,
  email?: string
): Promise<any | null> {
  const conditions: Record<string, any>[] = [];

  if (id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      conditions.push({ _id: new mongoose.Types.ObjectId(id) });
    }
    conditions.push({ id });
  }

  if (email) {
    conditions.push({ email: email.toLowerCase() });
  }

  if (conditions.length === 0) return null;

  return User.findOne({ $or: conditions }).lean();
}

export async function getUsersMapByIds(
  ids: string[]
): Promise<Map<string, PublicUser>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, PublicUser>();
  if (uniqueIds.length === 0) return map;

  const objectIds = uniqueIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const queryConditions: Record<string, any>[] = [{ id: { $in: uniqueIds } }];
  if (objectIds.length > 0) {
    queryConditions.push({ _id: { $in: objectIds } });
  }

  const users = await User.find({ $or: queryConditions }).lean();
  for (const u of users) {
    const serialized = serializeUser(u);
    if (u._id) map.set(u._id.toString(), serialized);
    if ((u as any).id) map.set((u as any).id, serialized);
  }
  return map;
}
