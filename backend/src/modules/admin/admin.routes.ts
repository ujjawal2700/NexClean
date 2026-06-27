import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireRole } from "../../shared/middleware/auth";
import * as c from "./admin.controller";
import { listLeads, deleteLead } from "../lead/lead.controller";

export const adminRouter = Router();

adminRouter.use(requireRole("admin"));

adminRouter.get("/stats", asyncHandler(c.stats));
adminRouter.get("/reports", asyncHandler(c.reports));

adminRouter.get("/bookings", asyncHandler(c.bookings));
adminRouter.patch("/bookings/:id/cancel", asyncHandler(c.cancelBooking));
adminRouter.patch("/bookings/:id/status", asyncHandler(c.setBookingStatus));
adminRouter.patch("/bookings/:id/assign", asyncHandler(c.assignBooking));
adminRouter.post("/bookings/:id/auto-assign", asyncHandler(c.autoAssignBooking));

adminRouter.get("/agents", asyncHandler(c.agents));
adminRouter.get("/agents/:id", asyncHandler(c.agentDetail));
adminRouter.get("/agents/:id/activity", asyncHandler(c.agentActivity));
adminRouter.patch("/agents/:id/status", asyncHandler(c.setAgentStatus));
adminRouter.patch("/agents/:id/area", asyncHandler(c.updateAgentArea));

adminRouter.get("/customers", asyncHandler(c.customers));
adminRouter.get("/customers/:id", asyncHandler(c.customerDetail));
adminRouter.get("/customers/:id/activity", asyncHandler(c.customerActivity));
adminRouter.patch("/customers/:id/status", asyncHandler(c.setCustomerStatus));

adminRouter.get("/payments", asyncHandler(c.payments));
adminRouter.get("/payments/stats", asyncHandler(c.paymentStats));
adminRouter.patch("/payments/:id/refund", asyncHandler(c.refundPayment));
adminRouter.patch("/payments/:id/settle", asyncHandler(c.settlePayment));

adminRouter.get("/pricing", asyncHandler(c.pricing));
adminRouter.put("/pricing", asyncHandler(c.updatePricingCtl));

adminRouter.get("/plans", asyncHandler(c.plans));
adminRouter.post("/plans", asyncHandler(c.createPlan));
adminRouter.patch("/plans/:id", asyncHandler(c.updatePlan));
adminRouter.delete("/plans/:id", asyncHandler(c.deletePlan));

adminRouter.get("/cities", asyncHandler(c.cities));
adminRouter.post("/cities", asyncHandler(c.createCity));
adminRouter.patch("/cities/:id", asyncHandler(c.updateCity));
adminRouter.delete("/cities/:id", asyncHandler(c.deleteCity));

adminRouter.get("/zones", asyncHandler(c.zones));
adminRouter.post("/zones", asyncHandler(c.createZone));
adminRouter.patch("/zones/:id", asyncHandler(c.updateZone));
adminRouter.delete("/zones/:id", asyncHandler(c.deleteZone));

adminRouter.get("/vehicle-categories", asyncHandler(c.vehicleCategories));
adminRouter.post("/vehicle-categories", asyncHandler(c.createVehicleCategory));
adminRouter.patch("/vehicle-categories/:id", asyncHandler(c.updateVehicleCategory));
adminRouter.delete("/vehicle-categories/:id", asyncHandler(c.deleteVehicleCategory));

adminRouter.get("/vehicle-brands", asyncHandler(c.vehicleBrands));
adminRouter.post("/vehicle-brands", asyncHandler(c.createVehicleBrand));
adminRouter.patch("/vehicle-brands/:id", asyncHandler(c.updateVehicleBrand));
adminRouter.delete("/vehicle-brands/:id", asyncHandler(c.deleteVehicleBrand));

adminRouter.get("/vehicle-brands/:id/models", asyncHandler(c.vehicleModels));
adminRouter.post("/vehicle-brands/:id/models", asyncHandler(c.createVehicleModel));
adminRouter.patch("/vehicle-brands/:id/models/:modelId", asyncHandler(c.updateVehicleModel));
adminRouter.delete("/vehicle-brands/:id/models/:modelId", asyncHandler(c.deleteVehicleModel));

adminRouter.get("/discount-codes", asyncHandler(c.discountCodes));
adminRouter.post("/discount-codes", asyncHandler(c.createDiscountCode));
adminRouter.patch("/discount-codes/:id", asyncHandler(c.updateDiscountCode));
adminRouter.delete("/discount-codes/:id", asyncHandler(c.deleteDiscountCode));

adminRouter.get("/referral-campaigns", asyncHandler(c.referralCampaigns));
adminRouter.post("/referral-campaigns", asyncHandler(c.createReferralCampaign));
adminRouter.patch("/referral-campaigns/:id", asyncHandler(c.updateReferralCampaign));
adminRouter.delete("/referral-campaigns/:id", asyncHandler(c.deleteReferralCampaign));

adminRouter.get("/promo-banners", asyncHandler(c.promoBanners));
adminRouter.post("/promo-banners", asyncHandler(c.createPromoBanner));
adminRouter.patch("/promo-banners/:id", asyncHandler(c.updatePromoBanner));
adminRouter.delete("/promo-banners/:id", asyncHandler(c.deletePromoBanner));

adminRouter.get("/campaigns", asyncHandler(c.campaigns));
adminRouter.get("/campaigns/audience-sizes", asyncHandler(c.campaignAudienceSizes));
adminRouter.post("/campaigns", asyncHandler(c.sendCampaign));

adminRouter.get("/content", asyncHandler(c.content));
adminRouter.put("/content", asyncHandler(c.updateContentCtl));

// Leads — customers from unserviced cities
adminRouter.get("/leads", asyncHandler(listLeads));
adminRouter.delete("/leads/:id", asyncHandler(deleteLead));

// Referrals logs
adminRouter.get("/referral-logs", asyncHandler(c.listReferralLogs));

// Upload media to Cloudinary
adminRouter.post("/upload", asyncHandler(c.uploadMedia));


