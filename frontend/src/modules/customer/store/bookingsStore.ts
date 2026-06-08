import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Booking, PlanId } from "../types";

type BookingsState = {
  bookings: Booking[];
  activePlan: PlanId | null;
  addBooking: (b: Omit<Booking, "id" | "createdAt" | "status">) => Booking;
  cancelBooking: (id: string) => void;
  setPlan: (plan: PlanId | null) => void;
};

/** Mock bookings + subscription state (persisted). Backend-backed later. */
export const useBookingsStore = create<BookingsState>()(
  persist(
    (set) => ({
      bookings: [],
      activePlan: null,

      addBooking: (b) => {
        const booking: Booking = {
          ...b,
          id: `NX${Math.floor(100000 + Math.random() * 900000)}`,
          status: "upcoming",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ bookings: [booking, ...s.bookings] }));
        return booking;
      },

      cancelBooking: (id) =>
        set((s) => ({
          bookings: s.bookings.map((bk) =>
            bk.id === id ? { ...bk, status: "cancelled" } : bk,
          ),
        })),

      setPlan: (plan) => set({ activePlan: plan }),
    }),
    { name: "nexclean-bookings" },
  ),
);
