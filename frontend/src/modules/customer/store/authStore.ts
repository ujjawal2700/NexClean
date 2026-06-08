import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Vehicle, Address } from "../types";
import { SEED_VEHICLES, SEED_ADDRESSES } from "../data/catalog";

type AuthState = {
  isAuthenticated: boolean;
  name: string;
  phone: string;
  vehicles: Vehicle[];
  addresses: Address[];
  login: (phone: string) => void;
  logout: () => void;
  updateProfile: (name: string) => void;
  addVehicle: (v: Omit<Vehicle, "id">) => void;
  removeVehicle: (id: string) => void;
  addAddress: (a: Omit<Address, "id">) => void;
  removeAddress: (id: string) => void;
};

/**
 * Mock customer auth + profile (persisted to localStorage).
 * Replaced by real JWT/phone-OTP auth against the backend in a later phase.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      name: "",
      phone: "",
      vehicles: SEED_VEHICLES,
      addresses: SEED_ADDRESSES,

      login: (phone) => set({ isAuthenticated: true, phone, name: "NexClean Member" }),
      logout: () => set({ isAuthenticated: false, name: "", phone: "" }),
      updateProfile: (name) => set({ name }),

      addVehicle: (v) =>
        set((s) => ({ vehicles: [...s.vehicles, { ...v, id: crypto.randomUUID() }] })),
      removeVehicle: (id) => set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) })),

      addAddress: (a) =>
        set((s) => ({ addresses: [...s.addresses, { ...a, id: crypto.randomUUID() }] })),
      removeAddress: (id) => set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) })),
    }),
    { name: "nexclean-auth" },
  ),
);
