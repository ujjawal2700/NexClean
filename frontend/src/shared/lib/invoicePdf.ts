import { amountInWords } from "./tax";
import { INVOICE_STATUS_LABEL, invoiceFileName, sellerAddress, type Invoice, type InvoiceTemplate } from "./invoice";

/** jsPDF's built-in fonts have no ₹ glyph, so the PDF writes "Rs.". */
function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}Rs. ${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) ?? /^#?(0f)(76)(6e)$/i.exec("#0f766e")!;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-";

async function logoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Builds the invoice PDF (A4) from the same data and template as the
 * on-screen InvoiceDocument. Returns the jsPDF document.
 */
export async function renderInvoicePdf(inv: Invoice, t: InvoiceTemplate) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const accent = hexToRgb(t.accentColor || "#0f766e");
  const s = inv.seller ?? {};
  const gray = (v: number) => doc.setTextColor(v, v, v);
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };

  // Accent bar
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 8, "F");
  y = 44;

  // Seller (left)
  let left = M;
  if (t.showLogo) {
    const logo = await logoDataUrl();
    if (logo) {
      doc.addImage(logo, "PNG", M, y - 14, 36, 36);
      left = M + 46;
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  gray(20);
  doc.text(s.tradeName || s.legalName || "NexClean", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  gray(110);
  let ly = y + 13;
  const sellerLines = [
    s.legalName && s.legalName !== s.tradeName ? s.legalName : "",
    ...doc.splitTextToSize(sellerAddress(s), 250),
    [s.phone, s.email, s.website].filter(Boolean).join(" · "),
    s.gstin ? `GSTIN ${s.gstin}${s.stateCode ? ` · State code ${s.stateCode}` : ""}` : "",
  ].filter(Boolean) as string[];
  for (const line of sellerLines) {
    doc.text(line, left, ly);
    ly += 11;
  }

  // Title block (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...accent);
  doc.text(t.title.toUpperCase(), W - M, y, { align: "right" });
  doc.setFontSize(10.5);
  gray(20);
  doc.text(inv.invoiceNumber, W - M, y + 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  gray(110);
  doc.text(`Issued ${fmtDate(inv.issuedAt)}`, W - M, y + 29, { align: "right" });
  doc.setFont("helvetica", "bold");
  const statusColor: [number, number, number] =
    inv.status === "paid" ? [22, 101, 52] : inv.status === "cancelled" ? [153, 27, 27] : [146, 64, 14];
  doc.setTextColor(...statusColor);
  doc.text(INVOICE_STATUS_LABEL[inv.status].toUpperCase(), W - M, y + 42, { align: "right" });

  y = Math.max(ly, y + 52) + 10;

  if (t.headerNote) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    gray(90);
    const lines = doc.splitTextToSize(t.headerNote, W - 2 * M - 16);
    doc.setFillColor(246, 247, 249);
    doc.roundedRect(M, y, W - 2 * M, lines.length * 11 + 12, 6, 6, "F");
    doc.text(lines, M + 8, y + 15);
    y += lines.length * 11 + 22;
  }

  // Bill to / Service details boxes
  const boxW = (W - 2 * M - 14) / 2;
  const box = (x: number, title: string, rows: string[]) => {
    doc.setDrawColor(226, 232, 240);
    const wrapped = rows.flatMap((r) => doc.splitTextToSize(r, boxW - 20) as string[]);
    const h = 28 + wrapped.length * 11;
    doc.roundedRect(x, y, boxW, h, 6, 6, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...accent);
    doc.text(title.toUpperCase(), x + 10, y + 14);
    doc.setFontSize(9.5);
    gray(20);
    let ry = y + 27;
    wrapped.forEach((r, i) => {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      if (i > 0) {
        doc.setFontSize(8.5);
        gray(90);
      }
      doc.text(r, x + 10, ry);
      ry += 11;
    });
    return h;
  };
  const billRows = [
    inv.billTo.name || "Customer",
    inv.billTo.address,
    [inv.billTo.phone, inv.billTo.email].filter(Boolean).join(" · "),
    inv.billTo.gstin ? `GSTIN ${inv.billTo.gstin}` : "",
  ].filter(Boolean);
  const serviceRows = [
    inv.service.packageName,
    `${fmtDate(inv.service.date)} · ${inv.service.slot}`,
    t.showVehicleDetails ? `${inv.service.vehicleName}${inv.service.vehiclePlate ? ` · ${inv.service.vehiclePlate}` : ""}` : "",
    t.showServiceAddress ? inv.service.address : "",
    t.showCleaner && inv.service.cleanerName ? `Specialist: ${inv.service.cleanerName}` : "",
  ].filter(Boolean);
  const h1 = box(M, t.labels.billTo, billRows);
  const h2 = box(M + boxW + 14, t.labels.serviceDetails, serviceRows);
  y += Math.max(h1, h2) + 18;

  // Line items
  const col = { n: M + 8, desc: M + 30, sac: W - M - 170, amt: W - M - 8 };
  doc.setFillColor(...accent);
  doc.roundedRect(M, y, W - 2 * M, 20, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("#", col.n, y + 13);
  doc.text(t.labels.description.toUpperCase(), col.desc, y + 13);
  doc.text("SAC", col.sac, y + 13);
  doc.text(t.labels.amount.toUpperCase(), col.amt, y + 13, { align: "right" });
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  inv.lines
    .filter((l) => l.kind !== "adjustment")
    .forEach((l, i) => {
      const desc = doc.splitTextToSize(l.description, col.sac - col.desc - 12) as string[];
      const rowH = Math.max(20, desc.length * 11 + 9);
      ensureSpace(rowH);
      gray(110);
      doc.text(String(i + 1), col.n, y + 14);
      gray(30);
      doc.text(desc, col.desc, y + 14);
      gray(110);
      doc.text(l.sac || "-", col.sac, y + 14);
      if (l.amount < 0) doc.setTextColor(4, 120, 87);
      else gray(30);
      doc.text(money(l.amount), col.amt, y + 14, { align: "right" });
      doc.setDrawColor(241, 245, 249);
      doc.line(M, y + rowH, W - M, y + rowH);
      y += rowH;
    });
  y += 16;

  // Totals (right) and words/payment (left)
  ensureSpace(170);
  const totalsX = W - M - 220;
  const startY = y;
  const totalRow = (label: string, value: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    gray(bold ? 20 : 90);
    doc.text(label, totalsX, y);
    doc.text(money(value), W - M - 8, y, { align: "right" });
    y += 14;
  };
  totalRow(t.labels.subtotal, inv.subtotal);
  if (inv.discountTotal > 0) totalRow("Discounts", -inv.discountTotal);
  totalRow(t.labels.taxable, inv.taxableAmount, true);
  if (t.showTaxBreakup && inv.taxAmount > 0) {
    if (inv.supplyType === "inter") totalRow(`IGST @ ${inv.taxRate}%`, inv.igstAmount);
    else {
      totalRow(`CGST @ ${inv.taxRate / 2}%`, inv.cgstAmount);
      totalRow(`SGST @ ${inv.taxRate / 2}%`, inv.sgstAmount);
    }
  } else {
    totalRow(inv.taxRate > 0 ? `${inv.taxLabel} @ ${inv.taxRate}%` : inv.taxLabel, inv.taxAmount);
  }
  if (inv.roundOff !== 0) totalRow("Round off", inv.roundOff);
  inv.lines.filter((l) => l.kind === "adjustment").forEach((l) => totalRow(l.description, l.amount));
  y += 2;
  doc.setFillColor(...accent);
  doc.roundedRect(totalsX - 8, y - 2, W - M - totalsX + 8, 26, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(t.labels.total, totalsX, y + 15);
  doc.text(money(inv.total), W - M - 8, y + 15, { align: "right" });
  const totalsEnd = y + 30;

  // Left column
  y = startY;
  const leftW = totalsX - M - 24;
  const block = (title: string, body: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    gray(120);
    doc.text(title.toUpperCase(), M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    gray(40);
    const lines = doc.splitTextToSize(body, leftW) as string[];
    doc.text(lines, M, y + 11);
    y += 16 + lines.length * 11;
  };
  if (t.showAmountInWords) block("Amount in words", amountInWords(inv.total));
  if (t.showPaymentInfo) {
    block(
      "Payment",
      inv.status === "cancelled"
        ? "Booking cancelled"
        : inv.paymentMethod
          ? `${inv.paymentMethod} · ${money(inv.amountPaid)} received`
          : "Payable to the specialist on completion",
    );
  }
  if (inv.notes) block("Notes", inv.notes);
  y = Math.max(y, totalsEnd) + 18;

  // Footer
  const footerLines = [
    ...(t.terms ? (doc.splitTextToSize(t.terms, W - 2 * M - (t.showSignature ? 190 : 0)) as string[]) : []),
  ];
  ensureSpace(footerLines.length * 10 + 80);
  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  gray(120);
  doc.text(footerLines, M, y);
  let fy = y + footerLines.length * 10 + 4;
  if (t.footerNote) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    gray(50);
    doc.text(doc.splitTextToSize(t.footerNote, W - 2 * M - 190), M, fy);
    fy += 12;
  }
  if (t.showSignature) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    gray(40);
    doc.text(`For ${s.legalName || s.tradeName || "NexClean"}`, W - M - 80, y, { align: "center" });
    doc.setDrawColor(203, 213, 225);
    doc.line(W - M - 150, y + 36, W - M - 10, y + 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    gray(90);
    doc.text(t.signatoryLabel, W - M - 80, y + 48, { align: "center" });
  }

  if (inv.status === "cancelled") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(80);
    doc.setTextColor(239, 68, 68);
    doc.saveGraphicsState();
    // @ts-expect-error GState exists at runtime on jsPDF
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.text("CANCELLED", W / 2, H / 2, { align: "center", angle: 24 });
    doc.restoreGraphicsState();
  }
  return doc;
}

/** Builds the PDF and triggers a browser download. */
export async function downloadInvoicePdf(inv: Invoice, t: InvoiceTemplate) {
  const doc = await renderInvoicePdf(inv, t);
  doc.save(invoiceFileName(inv));
}
