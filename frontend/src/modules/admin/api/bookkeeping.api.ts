import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import type { Invoice, InvoiceSeller, InvoiceTemplate, InvoiceWithTemplate } from "@shared/lib/invoice";
import { useAdminSession } from "../store/sessionStore";

export type BookkeepingConfig = {
  tax: { enabled: boolean; rate: number; label: string; supplyType: "intra" | "inter"; sacCode: string };
  business: Required<InvoiceSeller>;
  invoice: { prefix: string; numberPadding: number };
  template: InvoiceTemplate;
};

export type BookkeepingSummary = {
  from: string;
  to: string;
  bookings: number;
  cancelledBookings: number;
  grossServiceValue: number;
  discounts: number;
  coinDiscounts: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxCollected: number;
  roundOff: number;
  adjustments: number;
  totalBilled: number;
  cleanerPayouts: number;
  refunds: number;
  platformNet: number;
};

export type InvoicePage = { items: Invoice[]; page: number; limit: number; total: number; hasMore: boolean };

const k = {
  config: ["admin", "bookkeeping", "config"] as const,
  summary: (from: string, to: string) => ["admin", "bookkeeping", "summary", from, to] as const,
  invoices: (q: object) => ["admin", "bookkeeping", "invoices", q] as const,
  invoice: (id: string) => ["admin", "bookkeeping", "invoice", id] as const,
};

function useAuthed() {
  return useAdminSession((s) => s.authenticated);
}

export function useBookkeepingConfig() {
  const authed = useAuthed();
  return useQuery({ queryKey: k.config, queryFn: () => apiFetch<BookkeepingConfig>("/admin/bookkeeping/config"), enabled: authed });
}

type ConfigPatch = {
  [K in keyof BookkeepingConfig]?: K extends "template"
    ? Partial<Omit<InvoiceTemplate, "labels">> & { labels?: Partial<InvoiceTemplate["labels"]> }
    : Partial<BookkeepingConfig[K]>;
};

export function useUpdateBookkeepingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ConfigPatch) =>
      apiFetch<BookkeepingConfig>("/admin/bookkeeping/config", { method: "PUT", body: patch }),
    onSuccess: (data) => {
      qc.setQueryData(k.config, data);
      qc.invalidateQueries({ queryKey: ["admin", "bookkeeping", "invoice"] });
    },
  });
}

export function useResetInvoiceTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<BookkeepingConfig>("/admin/bookkeeping/template/reset", { method: "POST" }),
    onSuccess: (data) => qc.setQueryData(k.config, data),
  });
}

export function useBookkeepingSummary(from: string, to: string) {
  const authed = useAuthed();
  return useQuery({
    queryKey: k.summary(from, to),
    queryFn: () => apiFetch<BookkeepingSummary>(`/admin/bookkeeping/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    enabled: authed,
    placeholderData: keepPreviousData,
  });
}

export function useInvoices(q: { page: number; status: string; search: string }) {
  const authed = useAuthed();
  const params = new URLSearchParams({ page: String(q.page), limit: "20", status: q.status });
  if (q.search.trim()) params.set("q", q.search.trim());
  return useQuery({
    queryKey: k.invoices(q),
    queryFn: () => apiFetch<InvoicePage>(`/admin/bookkeeping/invoices?${params}`),
    enabled: authed,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string) {
  const authed = useAuthed();
  return useQuery({
    queryKey: k.invoice(id),
    queryFn: () => apiFetch<InvoiceWithTemplate>(`/admin/bookkeeping/invoices/${id}`),
    enabled: authed && !!id,
  });
}

export function useBookingInvoiceAdmin(bookingId: string, enabled: boolean) {
  const authed = useAuthed();
  return useQuery({
    queryKey: ["admin", "bookkeeping", "booking-invoice", bookingId],
    queryFn: () => apiFetch<InvoiceWithTemplate>(`/admin/bookings/${bookingId}/invoice`),
    enabled: authed && !!bookingId && enabled,
  });
}

export type InvoiceEdit = {
  billTo?: Partial<Invoice["billTo"]>;
  notes?: string;
  lines?: { index: number; description?: string; sac?: string }[];
};

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: InvoiceEdit) =>
      apiFetch<InvoiceWithTemplate>(`/admin/bookkeeping/invoices/${id}`, { method: "PATCH", body: patch }),
    onSuccess: (data) => {
      qc.setQueryData(k.invoice(id), data);
      qc.invalidateQueries({ queryKey: ["admin", "bookkeeping", "invoices"] });
    },
  });
}
