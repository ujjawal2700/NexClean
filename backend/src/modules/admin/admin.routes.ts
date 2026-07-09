import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireRole, requirePermission } from "../../shared/middleware/auth";
import * as c from "./admin.controller";
import { listLeads, deleteLead } from "../lead/lead.controller";

export const adminRouter = Router();

adminRouter.use(requireRole("admin"));

adminRouter.get("/stats", requirePermission("dashboard"), asyncHandler(c.stats));
adminRouter.get("/reports", requirePermission("reports"), asyncHandler(c.reports));

adminRouter.get("/bookings", requirePermission("bookings"), asyncHandler(c.bookings));
adminRouter.patch("/bookings/:id/cancel", requirePermission("bookings"), asyncHandler(c.cancelBooking));
adminRouter.patch("/bookings/:id/status", requirePermission("bookings"), asyncHandler(c.setBookingStatus));
adminRouter.patch("/bookings/:id/assign", requirePermission("bookings"), asyncHandler(c.assignBooking));
adminRouter.post("/bookings/:id/auto-assign", requirePermission("bookings"), asyncHandler(c.autoAssignBooking));
adminRouter.get("/bookings/:id/assignable-agents", requirePermission("bookings"), asyncHandler(c.assignableAgents));
adminRouter.get("/dispatch/queue", requirePermission("bookings"), asyncHandler(c.dispatchQueue));

adminRouter.get("/agents", requirePermission("agents"), asyncHandler(c.agents));
adminRouter.get("/agents/:id", requirePermission("agents"), asyncHandler(c.agentDetail));
adminRouter.get("/agents/:id/activity", requirePermission("agents"), asyncHandler(c.agentActivity));
adminRouter.patch("/agents/:id/status", requirePermission("agents"), asyncHandler(c.setAgentStatus));
adminRouter.patch("/agents/:id/area", requirePermission("agents"), asyncHandler(c.updateAgentArea));

adminRouter.get("/customers", requirePermission("customers"), asyncHandler(c.customers));
adminRouter.get("/customers/:id", requirePermission("customers"), asyncHandler(c.customerDetail));
adminRouter.get("/customers/:id/activity", requirePermission("customers"), asyncHandler(c.customerActivity));
adminRouter.patch("/customers/:id/status", requirePermission("customers"), asyncHandler(c.setCustomerStatus));

adminRouter.get("/payments", requirePermission("payments"), asyncHandler(c.payments));
adminRouter.get("/payments/stats", requirePermission("payments"), asyncHandler(c.paymentStats));
adminRouter.patch("/payments/:id/refund", requirePermission("payments"), asyncHandler(c.refundPayment));
adminRouter.patch("/payments/:id/settle", requirePermission("payments"), asyncHandler(c.settlePayment));

adminRouter.get("/pricing", requirePermission("pricing"), asyncHandler(c.pricing));
adminRouter.put("/pricing", requirePermission("pricing"), asyncHandler(c.updatePricingCtl));

adminRouter.get("/plans", requirePermission("plans"), asyncHandler(c.plans));
adminRouter.post("/plans", requirePermission("plans"), asyncHandler(c.createPlan));
adminRouter.patch("/plans/:id", requirePermission("plans"), asyncHandler(c.updatePlan));
adminRouter.delete("/plans/:id", requirePermission("plans"), asyncHandler(c.deletePlan));

adminRouter.get("/cities", requirePermission("locations"), asyncHandler(c.cities));
adminRouter.post("/cities", requirePermission("locations"), asyncHandler(c.createCity));
adminRouter.patch("/cities/:id", requirePermission("locations"), asyncHandler(c.updateCity));
adminRouter.delete("/cities/:id", requirePermission("locations"), asyncHandler(c.deleteCity));

adminRouter.get("/zones", requirePermission("locations"), asyncHandler(c.zones));
adminRouter.post("/zones", requirePermission("locations"), asyncHandler(c.createZone));
adminRouter.patch("/zones/:id", requirePermission("locations"), asyncHandler(c.updateZone));
adminRouter.delete("/zones/:id", requirePermission("locations"), asyncHandler(c.deleteZone));

adminRouter.get("/vehicle-categories", requirePermission("vehicle-categories"), asyncHandler(c.vehicleCategories));
adminRouter.post("/vehicle-categories", requirePermission("vehicle-categories"), asyncHandler(c.createVehicleCategory));
adminRouter.patch("/vehicle-categories/:id", requirePermission("vehicle-categories"), asyncHandler(c.updateVehicleCategory));
adminRouter.delete("/vehicle-categories/:id", requirePermission("vehicle-categories"), asyncHandler(c.deleteVehicleCategory));

adminRouter.get("/vehicle-brands", requirePermission("vehicle-brands"), asyncHandler(c.vehicleBrands));
adminRouter.post("/vehicle-brands", requirePermission("vehicle-brands"), asyncHandler(c.createVehicleBrand));
adminRouter.patch("/vehicle-brands/:id", requirePermission("vehicle-brands"), asyncHandler(c.updateVehicleBrand));
adminRouter.delete("/vehicle-brands/:id", requirePermission("vehicle-brands"), asyncHandler(c.deleteVehicleBrand));

adminRouter.get("/vehicle-brands/:id/models", requirePermission("vehicle-brands"), asyncHandler(c.vehicleModels));
adminRouter.post("/vehicle-brands/:id/models", requirePermission("vehicle-brands"), asyncHandler(c.createVehicleModel));
adminRouter.patch("/vehicle-brands/:id/models/:modelId", requirePermission("vehicle-brands"), asyncHandler(c.updateVehicleModel));
adminRouter.delete("/vehicle-brands/:id/models/:modelId", requirePermission("vehicle-brands"), asyncHandler(c.deleteVehicleModel));

adminRouter.get("/discount-codes", requirePermission("promotions"), asyncHandler(c.discountCodes));
adminRouter.post("/discount-codes", requirePermission("promotions"), asyncHandler(c.createDiscountCode));
adminRouter.patch("/discount-codes/:id", requirePermission("promotions"), asyncHandler(c.updateDiscountCode));
adminRouter.delete("/discount-codes/:id", requirePermission("promotions"), asyncHandler(c.deleteDiscountCode));

adminRouter.get("/special-coupons", requirePermission("promotions"), asyncHandler(c.specialCoupons));
adminRouter.post("/special-coupons/generate", requirePermission("promotions"), asyncHandler(c.generateSpecialCoupons));
adminRouter.patch("/special-coupons/:id/assign", requirePermission("promotions"), asyncHandler(c.assignSpecialCoupon));
adminRouter.patch("/special-coupons/:id/toggle-active", requirePermission("promotions"), asyncHandler(c.toggleSpecialCouponActive));
adminRouter.patch("/special-coupons/:id/reactivate", requirePermission("promotions"), asyncHandler(c.reactivateSpecialCoupon));

adminRouter.get("/referral-campaigns", requirePermission("promotions"), asyncHandler(c.referralCampaigns));
adminRouter.post("/referral-campaigns", requirePermission("promotions"), asyncHandler(c.createReferralCampaign));
adminRouter.patch("/referral-campaigns/:id", requirePermission("promotions"), asyncHandler(c.updateReferralCampaign));
adminRouter.delete("/referral-campaigns/:id", requirePermission("promotions"), asyncHandler(c.deleteReferralCampaign));

adminRouter.get("/promo-banners", requirePermission("promotions"), asyncHandler(c.promoBanners));
adminRouter.post("/promo-banners", requirePermission("promotions"), asyncHandler(c.createPromoBanner));
adminRouter.patch("/promo-banners/:id", requirePermission("promotions"), asyncHandler(c.updatePromoBanner));
adminRouter.delete("/promo-banners/:id", requirePermission("promotions"), asyncHandler(c.deletePromoBanner));

adminRouter.get("/campaigns", requirePermission("promotions"), asyncHandler(c.campaigns));
adminRouter.get("/campaigns/audience-sizes", requirePermission("promotions"), asyncHandler(c.campaignAudienceSizes));
adminRouter.post("/campaigns", requirePermission("promotions"), asyncHandler(c.sendCampaign));

adminRouter.get("/content", requirePermission("content"), asyncHandler(c.content));
adminRouter.put("/content", requirePermission("content"), asyncHandler(c.updateContentCtl));

// Leads — customers from unserviced cities
adminRouter.get("/leads", requirePermission("leads"), asyncHandler(listLeads));
adminRouter.delete("/leads/:id", requirePermission("leads"), asyncHandler(deleteLead));

// Referrals logs
adminRouter.get("/referral-logs", requirePermission("referrals"), asyncHandler(c.listReferralLogs));

// Upload media to Cloudinary
adminRouter.post("/upload", asyncHandler(c.uploadMedia));

// Roles CRUD
adminRouter.get("/roles", requirePermission("roles"), asyncHandler(c.listRoles));
adminRouter.post("/roles", requirePermission("roles"), asyncHandler(c.createRole));
adminRouter.patch("/roles/:id", requirePermission("roles"), asyncHandler(c.updateRole));
adminRouter.delete("/roles/:id", requirePermission("roles"), asyncHandler(c.deleteRole));

// Staff CRUD
adminRouter.get("/staff", requirePermission("roles"), asyncHandler(c.listStaff));
adminRouter.post("/staff", requirePermission("roles"), asyncHandler(c.createStaff));
adminRouter.patch("/staff/:id", requirePermission("roles"), asyncHandler(c.updateStaff));
adminRouter.delete("/staff/:id", requirePermission("roles"), asyncHandler(c.deleteStaff));
