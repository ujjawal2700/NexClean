import type { Request, Response } from "express";
import { z } from "zod";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { User } from "../user/user.model";
import { getBookkeepingConfig, getTaxSettings, resetInvoiceTemplate, updateBookkeepingConfig } from "./bookkeepingConfig.service";
import {
  getAdminInvoice,
  getAdminInvoiceForBooking,
  getBookkeepingSummary,
  getCustomerInvoice,
  listInvoices,
  updateInvoice,
} from "./invoice.service";

const text = (max: number) => z.string().trim().max(max);
const GSTIN = /^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^$|^[A-Z]{5}[0-9]{4}[A-Z]$/;

const configSchema = z
  .object({
    tax: z
      .object({
        enabled: z.boolean(),
        rate: z.number().min(0).max(28),
        label: text(20).min(1),
        supplyType: z.enum(["intra", "inter"]),
        sacCode: text(10),
      })
      .partial(),
    business: z
      .object({
        legalName: text(120).min(1),
        tradeName: text(120),
        gstin: z.string().trim().toUpperCase().regex(GSTIN, "GSTIN should look like 22AAAAA0000A1Z5"),
        pan: z.string().trim().toUpperCase().regex(PAN, "PAN should look like AAAAA0000A"),
        addressLine: text(200),
        city: text(60),
        state: text(60),
        stateCode: text(4),
        pincode: z.string().trim().regex(/^$|^[1-9][0-9]{5}$/, "Pincode should be 6 digits"),
        email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
        phone: text(20),
        website: text(120),
      })
      .partial(),
    invoice: z
      .object({
        prefix: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9-]+$/, "Prefix can use letters, numbers and dashes"),
        numberPadding: z.number().int().min(3).max(8),
      })
      .partial(),
    template: z
      .object({
        title: text(40).min(1),
        accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour"),
        showLogo: z.boolean(),
        headerNote: text(300),
        footerNote: text(300),
        terms: text(2000),
        signatoryLabel: text(60),
        showVehicleDetails: z.boolean(),
        showServiceAddress: z.boolean(),
        showCleaner: z.boolean(),
        showPaymentInfo: z.boolean(),
        showTaxBreakup: z.boolean(),
        showAmountInWords: z.boolean(),
        showSignature: z.boolean(),
        labels: z
          .object({
            billTo: text(30).min(1),
            serviceDetails: text(30).min(1),
            description: text(30).min(1),
            amount: text(30).min(1),
            subtotal: text(30).min(1),
            taxable: text(30).min(1),
            total: text(30).min(1),
          })
          .partial(),
      })
      .partial(),
  })
  .partial();

/* --------------------------------- admin --------------------------------- */

export async function getConfig(_req: Request, res: Response): Promise<Response> {
  return ok(res, await getBookkeepingConfig());
}

export async function updateConfig(req: Request, res: Response): Promise<Response> {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid settings");
  return ok(res, await updateBookkeepingConfig(parsed.data), "Bookkeeping settings saved");
}

export async function resetTemplate(_req: Request, res: Response): Promise<Response> {
  return ok(res, await resetInvoiceTemplate(), "Invoice template reset to default");
}

const rangeSchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

export async function summary(req: Request, res: Response): Promise<Response> {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) throw ApiError.badRequest("Invalid date range");
  const to = parsed.data.to ?? new Date();
  const from = parsed.data.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from > to) throw ApiError.badRequest("Start date must be before end date");
  return ok(res, await getBookkeepingSummary(from, to));
}

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["all", "issued", "paid", "cancelled"]).default("all"),
  q: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export async function invoices(req: Request, res: Response): Promise<Response> {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) throw ApiError.badRequest("Invalid filters");
  return ok(res, await listInvoices(parsed.data));
}

export async function invoice(req: Request, res: Response): Promise<Response> {
  return ok(res, await getAdminInvoice(String(req.params.id)));
}

export async function bookingInvoice(req: Request, res: Response): Promise<Response> {
  return ok(res, await getAdminInvoiceForBooking(String(req.params.id)));
}

const editSchema = z.object({
  billTo: z
    .object({
      name: text(120),
      phone: text(20),
      email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
      address: text(300),
      gstin: z.string().trim().toUpperCase().regex(GSTIN, "Customer GSTIN should look like 22AAAAA0000A1Z5"),
    })
    .partial()
    .optional(),
  notes: text(1000).optional(),
  lines: z
    .array(z.object({ index: z.number().int().min(0), description: text(200).min(1).optional(), sac: text(10).optional() }))
    .max(20)
    .optional(),
});

export async function editInvoice(req: Request, res: Response): Promise<Response> {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid invoice changes");
  const admin = await User.findById(req.userId).select("name email").lean();
  return ok(
    res,
    await updateInvoice(String(req.params.id), parsed.data, admin?.name || admin?.email || "Admin"),
    "Invoice updated",
  );
}

/* ------------------------------ customer/public ---------------------------- */

export async function customerInvoice(req: Request, res: Response): Promise<Response> {
  return ok(res, await getCustomerInvoice(req.userId!, String(req.params.id)));
}

/** What checkout needs to show GST before the customer commits. No business details. */
export async function publicTax(_req: Request, res: Response): Promise<Response> {
  const t = await getTaxSettings();
  return ok(res, { enabled: t.enabled, rate: t.rate, label: t.label, supplyType: t.supplyType });
}
