import { z } from "zod";

export const createBookingSchema = z.object({
  vehicleType: z.string().min(1),
  vehicleName: z.string().min(1).max(60),
  packageId: z.string().min(1),
  date: z.string().datetime({ message: "date must be an ISO datetime" }),
  slot: z.string().min(1),
  addressLabel: z.string().min(1),
  addressLine: z.string().min(1),
  discountCode: z.string().trim().min(1).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
