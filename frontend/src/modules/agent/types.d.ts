import type { CarType } from "@shared/components/visual/CarSilhouette";
export type { CarType };
export declare const VEHICLE_LABEL: Record<CarType, string>;
/** Lifecycle of a job from the agent's perspective. */
export type JobStatus = "assigned" | "enroute" | "arrived" | "in_progress" | "completed";
export declare const STATUS_FLOW: JobStatus[];
export declare const STATUS_LABEL: Record<JobStatus, string>;
/** Label for the button that advances to the next status. */
export declare const NEXT_ACTION: Partial<Record<JobStatus, string>>;
export type Job = {
    id: string;
    customerName: string;
    vehicleType: CarType;
    vehicleName: string;
    packageName: string;
    date: string;
    slot: string;
    addressLabel: string;
    addressLine: string;
    society: string;
    distanceKm: number | null;
    price: number;
    payout: number;
    status: JobStatus;
    hasBefore: boolean;
    hasAfter: boolean;
};
/** A live dispatch offer pushed to the agent (Uber-style incoming request). */
export type JobOffer = {
    bookingId: string;
    customerName: string;
    vehicleType: CarType;
    vehicleName: string;
    packageName: string;
    addressLabel: string;
    addressLine: string;
    society: string;
    date: string;
    slot: string;
    price: number;
    payout: number;
    distanceKm: number | null;
    isSubscriptionWash: boolean;
    expiresAt: string;
};
export type AreaAlert = {
    id: string;
    society: string;
    sentCount: number;
    createdAt: string;
};
export type AgentProfile = {
    id: string;
    name: string;
    phone: string;
    role: string;
    area: string;
    rating: number;
    jobsDone: number;
    online: boolean;
    agentStatus: "verified" | "pending" | "suspended";
    aadharNumber?: string;
    aadharFrontUrl?: string;
    aadharBackUrl?: string;
};
export type AgentSummary = {
    jobsToday: number;
    completedToday: number;
    earnedToday: number;
    potentialToday: number;
};
