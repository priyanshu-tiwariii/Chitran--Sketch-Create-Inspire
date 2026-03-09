import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import apiError from "../helpers/apiError";
import { env } from "@repo/backend-common/config";

interface JwtUserPayload {
  id: string;
  email: string;
  name: string;
}

declare module "express" {
  interface Request {
    user?: JwtUserPayload;
  }
}

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next(new apiError(401, "Access Denied: No token provided"));
    }

    const token = authHeader.split(" ")[1]!;
    // jwt.verify with just two args returns string | JwtPayload.
    // We cast through unknown to our known payload shape after verifying presence.
    const raw = jwt.verify(token, env.JWT_SECRET!) as unknown as JwtUserPayload;

    req.user = {
      id: raw.id,
      email: raw.email,
      name: raw.name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new apiError(401, "Token Expired"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new apiError(401, "Invalid Token"));
    }
    next(new apiError(401, "Authentication failed"));
  }
};