import { z } from "zod";

export const actorSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(500).optional(),
});

export const holdSchema = actorSchema.extend({
  reason: z.string().trim().min(3).max(500),
});

export const reserveLotSchema = z.object({
  orderLineId: z.string().min(1),
  productId: z.string().min(1),
  psBatchId: z.string().min(1),
  quantity: z.number().int().positive().max(100000),
  userId: z.string().min(1),
});

export const releaseReservationSchema = z.object({
  assignmentId: z.string().min(1),
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

export const fulfillReservationSchema = z.object({
  assignmentId: z.string().min(1),
  userId: z.string().min(1),
});
