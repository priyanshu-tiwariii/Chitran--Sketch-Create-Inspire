import { prisma } from "../db/index";
import asyncHandler from "../helpers/asyncHandler";
import apiError from "../helpers/apiError";
import apiResponse from "../helpers/apiResponse";
import { schemas } from "@repo/common/schemas";
import { z } from "zod";

type StrokeInput = z.infer<typeof schemas.StrokeSchema>;

const DeltaSchema = z.object({
  actions: z.object({
    created: schemas.StrokeSchema.array().default([]),
    updated: schemas.StrokeSchema.array().default([]),
    deleted: z.string().array().default([]),
  }),
});

const mapShapeToCreateData = (shape: StrokeInput, fileId: string) => ({
  ...(shape.id ? { id: shape.id } : {}),
  fileId,
  type: shape.type,
  x: shape.x ?? 0,
  y: shape.y ?? 0,
  width: shape.width ?? 0,
  height: shape.height ?? 0,
  color: shape.color ?? "#000000",
  points: shape.points ?? [],
  rotation: shape.rotation ?? 0,
  strokeWidth: shape.strokeWidth ?? 1,
  radius: shape.radius ?? 0,
  text: shape.text ?? "",
  fontSize: shape.fontSize ?? 16,
  fontFamily: shape.fontFamily ?? "Arial",
});

const mapShapeToUpdateData = (shape: StrokeInput) => ({
  type: shape.type,
  x: shape.x ?? 0,
  y: shape.y ?? 0,
  width: shape.width ?? 0,
  height: shape.height ?? 0,
  color: shape.color ?? "#000000",
  points: shape.points ?? [],
  rotation: shape.rotation ?? 0,
  strokeWidth: shape.strokeWidth ?? 1,
  radius: shape.radius ?? 0,
  text: shape.text ?? "",
  fontSize: shape.fontSize ?? 16,
  fontFamily: shape.fontFamily ?? "Arial",
});

export const getStroke = asyncHandler(async (req: any, res: any) => {
  try {
    const fileId = req.params.fileId;
    const isFileExist = await prisma.createdFile.findUnique({
      where: { id: fileId },
    });

    if (!isFileExist) {
      throw new apiError(404, "File not found");
    }

    if (isFileExist.collabMode === false && isFileExist.createdByUserId !== req.user.id) {
      throw new apiError(403, "You are not allowed to access this file");
    }

    const userId = req.user.id;
    const isOwner = isFileExist.createdByUserId === userId;

    if (isOwner) {
    } else if (isFileExist.collabMode === true) {
      const collaborator = await prisma.collaborator.findFirst({
        where: { userId: userId, fileId: fileId },
      });
      if (!collaborator) {
        throw new apiError(403, "You are not a collaborator on this file");
      }
    } else {
      throw new apiError(403, "You are not allowed to access this file");
    }
    // To Do -> add logic to check if user is a collaborator

    const strokes = await prisma.stroke.findMany({
      where: { fileId: fileId },
    });

    const normalized = strokes.map((s: any) => ({
      id: s.id,
      fileId: s.fileId,
      type: s.type,
      x: s.x,
      y: s.y,
      width: s.width ?? 0,
      height: s.height ?? 0,
      strokeWidth: s.strokeWidth ?? 1,
      radius: s.radius ?? 0,
      text: s.text ?? "",
      fontSize: s.fontSize ?? 16,
      fontFamily: s.fontFamily ?? "Arial",
      color: s.color ?? "#000000",         
      points: s.points ?? [],           
      rotation: s.rotation ?? 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    console.log(`Fetched ${normalized.length} strokes for fileId: ${fileId}`);
    console.log("Strokes data:", normalized);



  return res.status(200).json(new apiResponse(normalized, 200, "Strokes fetched successfully", true));

    

    
  } catch (error) {
    console.error("Error fetching strokes:", error);
    if (error instanceof apiError) {
      throw new apiError(error.status, error.message);
    } else if (error instanceof Error) {
      throw new apiError(500, error.message || "Database error while fetching strokes");
    } else {
      throw new apiError(500, "Unknown error occurred while fetching strokes");
    }
  }
});

// --- SAVE/SYNC FUNCTION (delta-based) ---
export const syncStrokes = asyncHandler(async (req: any, res: any) => {
  try {
    const fileId = req.params.fileId;

    const isFileExist = await prisma.createdFile.findUnique({
      where: { id: fileId },
    });

    if (!isFileExist) {
      throw new apiError(404, "File not found");
    }

    const userId = req.user.id;

    const isUserAllowed = await prisma.collaborator.findFirst({
      where: { userId, fileId },
    });

    if (isUserAllowed?.role !== "ADMIN" && isUserAllowed?.role !== "EDITOR") {
      throw new apiError(403, "You are not allowed to make changes");
    }

    if (isFileExist.collabMode === false && isFileExist.createdByUserId !== userId) {
      throw new apiError(403, "You are not allowed to make changes in this file");
    }

    const parsedBody = DeltaSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new apiError(400, "Invalid delta payload", parsedBody.error.errors);
    }

    const { actions } = parsedBody.data;

    await prisma.$transaction(async (tx) => {
      // 1. Process deletions
      if (actions.deleted.length > 0) {
        await tx.stroke.deleteMany({
          where: { id: { in: actions.deleted }, fileId },
        });
      }

      // 2. Process creations
      if (actions.created.length > 0) {
        await tx.stroke.createMany({
          data: actions.created.map((shape) => mapShapeToCreateData(shape, fileId)),
          skipDuplicates: true,
        });
      }

      // 3. Process updates (individual to support partial field changes)
      for (const shape of actions.updated) {
        if (!shape.id) continue;
        await tx.stroke.update({
          where: { id: shape.id },
          data: mapShapeToUpdateData(shape),
        });
      }
    });

    return res.status(200).json(new apiResponse(null, 200, "Canvas synced successfully", true));
  } catch (error) {
    if (error instanceof apiError) {
      throw new apiError(error.status, error.message);
    } else if (error instanceof Error) {
      throw new apiError(500, error.message || "Database error while syncing canvas");
    } else {
      throw new apiError(500, "Unknown error occurred while syncing canvas");
    }
  }
});
