import { z } from "zod";

export const createBatchSchema = z.object({
  productId: z.string().min(1),
  shipmentId: z.string().min(1).optional().nullable(),
  manufacturerLotNumber: z.string().trim().min(1).max(120),
  quantityReceived: z.number().int().positive().max(1_000_000),
  manufactureDate: z.coerce.date().optional().nullable(),
  expirationOrRetestDate: z.coerce.date().optional().nullable(),
  receivedDate: z.coerce.date().optional().nullable(),
  createdByUserId: z.string().min(1).optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
