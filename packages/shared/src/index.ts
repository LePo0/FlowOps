import { z } from "zod";

export const NodeTypeSchema = z.enum(["http", "condition", "transform"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;