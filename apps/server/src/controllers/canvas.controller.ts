import { prisma } from "../db/index";
import asyncHandler from "../helpers/asyncHandler";
import apiError from "../helpers/apiError";
import apiResponse from "../helpers/apiResponse";
import { schemas } from "@repo/common/schemas";         
import type { Shape } from "@repo/common/types";    

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

// --- SAVE/SYNC FUNCTION ---
export const syncStrokes = asyncHandler(async (req: any, res: any) => {
  try {
    console.log("Syncing strokes...");
    const fileId = req.params.fileId;
    const { shapes } = req.body;
    const isFileExist = await prisma.createdFile.findUnique({
      where: { id: fileId },
    });
    console.log("File existence check:", isFileExist);
    if (!isFileExist) {
      throw new apiError(404, "File not found");
    }
    const user = req.user;
    const userId = user.id;

    const isUserAllowed = await prisma.collaborator.findFirst({
      where: { userId: userId, fileId: fileId },
    });

    if (isUserAllowed?.role !== "ADMIN" && isUserAllowed?.role !== "EDITOR") {
      throw new apiError(403, "You are not allowed to make changes");
    }
    if (isFileExist.collabMode === false && isFileExist.createdByUserId !== userId) {
      throw new apiError(403, "You are not allowed to make changes in this file");
    }

    const parsedShapes = schemas.StrokeSchema.array().safeParse(shapes);
    if (!parsedShapes.success) {
      throw new apiError(400, "Invalid shape data", parsedShapes.error.errors);
    }

    console.log("Parsed shapes:", parsedShapes.data.length);
    console.log("Parsed shapes data:", parsedShapes.data);
    const validatedShapes = parsedShapes.data as Shape[];

    console.log("Validated shapes:", validatedShapes.length);
    const strokesToCreate = validatedShapes.map((shape) => ({
      id: shape.id,
      fileId: fileId,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      color: shape.color,
      points: shape.points ?? [],
      rotation: shape.rotation,
      strokeWidth: shape.strokeWidth,
      radius: shape.radius,
      text: shape.text,
      fontSize: shape.fontSize,
      fontFamily: shape.fontFamily,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.stroke.deleteMany({
        where: { fileId: fileId },
      });

      if (strokesToCreate.length > 0) {
        await tx.stroke.createMany({
          data: strokesToCreate,
        });
      }
    });

    console.log("Canvas saved successfully");
    return res.status(200).json(new apiResponse(null, 200, "Canvas saved successfully", true));
  } catch (error) {
    console.error("Error saving canvas:", error);
    if (error instanceof apiError) {
      throw new apiError(error.status, error.message);
    } else if (error instanceof Error) {
      throw new apiError(500, error.message || "Database error while saving canvas");
    } else {
      throw new apiError(500, "Unknown error occurred while saving canvas");
    }
  }
});
