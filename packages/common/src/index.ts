export * from "./schema/FileSchema";
import { z } from "zod";
import { CollaboratorSchema } from "./schema/CollaboratorSchema";
import { FileSchema } from "./schema/FileSchema";
import { StrokeSchema } from "./schema/StrokeSchema";
import { UserSchema } from "./schema/UserSchema";

export const schemas = {
  UserSchema,
  FileSchema,
  CollaboratorSchema,
  StrokeSchema,
};

export type Schemas = typeof schemas;
export type { Shape, ShapeType } from "./types";
