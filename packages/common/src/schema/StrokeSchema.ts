import {z} from "zod";


export const StrokeSchema = z.object({
    id: z.union([z.string(),z.number()]).transform(String).optional(),
    type: z.string(),
    x: z.number().optional().default(0),
    y: z.number().optional().default(0),
    width: z.number().optional().default(0),
    height: z.number().optional().default(0),
    radius: z.number().optional().default(0),
    text: z.string().optional().default(""),
    fontSize: z.number().optional().default(16),
    fontFamily: z.string().optional().default("Arial"),
    color: z.string().optional().default("#000000"),
    points: z.any().optional(),
    rotation: z.number().optional().default(0),
    strokeWidth: z.number().optional().default(1)
});



