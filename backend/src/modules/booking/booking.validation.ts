import { z } from "zod";
import { VEHICLE_TYPES } from "../catalog/catalog.data";

export const createBookingSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES),
  vehicleName: z.string().min(1).max(60),
  packageId: z.string().min(1),
  date: z.string().datetime({ message: "date must be an ISO datetime" }),
  slot: z.string().min(1),
  addressLabel: z.string().min(1),
  addressLine: z.string().min(1),
  discountCode: z.string().trim().min(1).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
