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
  // Service-location geo, captured from Google Places on the client. Optional so
  // older clients still work — a booking without coords routes to the admin queue.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
