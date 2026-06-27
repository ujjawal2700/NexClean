type ReceiptBooking = {
  id: string;
  customerName: string;
  vehicleName: string;
  packageName: string;
  date: string;
  slot: string;
  society: string;
  price: number;
  status: string;
  agentName: string | null;
};

type ReceiptPayment = {
  orderId: string;
  paymentId: string | null;
  status: string;
  amount: number;
  createdAt: string;
  customerName: string;
  bookingId: string | null;
  society: string;
  agentName: string | null;
} | null;

type ReceiptRow = { label: string; value: string };

type ReceiptData = {
  docId: string;
  customerName: string;
  rows: ReceiptRow[];
  amountLabel: string;
  amount: number;
};

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Draws the shared single-page receipt layout (logo top-right) and returns the finished doc. */
async function renderReceipt(data: ReceiptData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 60;

  const logo = await loadLogoDataUrl();
  if (logo) {
    doc.addImage(logo, "PNG", pageWidth - margin - 44, y - 30, 44, 44);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text("NexClean", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Doorstep car care", margin, y + 16);
  doc.setTextColor(0);

  y += 46;
  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Payment Receipt", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.docId, pageWidth - margin, y, { align: "right" });
  y += 34;

  for (const { label, value } of data.rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(120);
    doc.text(label, margin, y);
    doc.setTextColor(20);
    doc.text(value, margin + 170, y);
    y += 22;
  }

  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(data.amountLabel, margin, y);
  doc.text(`Rs. ${data.amount.toLocaleString("en-IN")}`, pageWidth - margin, y, { align: "right" });

  y += 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Thank you for choosing NexClean. This is a system-generated receipt.", margin, y);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, margin, y + 14);

  return doc;
}

function amountLabelFor(bookingStatus: string | null, paymentStatus: string | null): string {
  if (paymentStatus === "refunded") return "Amount refunded";
  if (paymentStatus === "paid" || paymentStatus === "mock") return "Amount paid";
  if (bookingStatus === "completed") return "Amount paid";
  if (bookingStatus === "cancelled") return "Booking amount (unpaid)";
  return "Booking amount";
}

/** Builds a single-page PDF receipt for a booking and triggers a browser download. */
export async function downloadBookingReceipt(
  booking: ReceiptBooking,
  payment: ReceiptPayment,
  categoryLabel: string,
) {
  const rows: ReceiptRow[] = [
    { label: "Customer", value: booking.customerName },
    { label: "Vehicle", value: `${booking.vehicleName} (${categoryLabel})` },
    { label: "Package", value: booking.packageName },
    {
      label: "Service date",
      value: `${new Date(booking.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${booking.slot}`,
    },
    { label: "Location", value: booking.society || "—" },
    { label: "Agent assigned", value: booking.agentName ?? "Not yet assigned" },
    { label: "Booking status", value: booking.status.replace("_", " ") },
  ];
  if (payment) {
    rows.push({ label: "Order ID", value: payment.orderId });
    if (payment.paymentId) rows.push({ label: "Payment ID", value: payment.paymentId });
    rows.push({ label: "Payment status", value: payment.status });
  }

  const doc = await renderReceipt({
    docId: `Booking #${booking.id}`,
    customerName: booking.customerName,
    rows,
    amountLabel: amountLabelFor(booking.status, payment?.status ?? null),
    amount: booking.price,
  });
  doc.save(`nexclean-receipt-${booking.id}.pdf`);
}

/** Builds a single-page PDF receipt for a payment record and triggers a browser download. */
export async function downloadPaymentReceipt(
  payment: NonNullable<ReceiptPayment>,
  booking: ReceiptBooking | null,
  categoryLabel: string,
) {
  const rows: ReceiptRow[] = [{ label: "Customer", value: payment.customerName }];
  if (booking) {
    rows.push({ label: "Vehicle", value: `${booking.vehicleName} (${categoryLabel})` });
    rows.push({ label: "Package", value: booking.packageName });
  }
  rows.push({
    label: "Payment date",
    value: new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
  });
  rows.push({ label: "Location", value: (booking?.society || payment.society) || "—" });
  if (booking?.agentName || payment.agentName) {
    rows.push({ label: "Agent assigned", value: booking?.agentName ?? payment.agentName ?? "—" });
  }
  rows.push({ label: "Order ID", value: payment.orderId });
  if (payment.paymentId) rows.push({ label: "Payment ID", value: payment.paymentId });
  rows.push({ label: "Payment status", value: payment.status });

  const doc = await renderReceipt({
    docId: `Order #${payment.orderId}`,
    customerName: payment.customerName,
    rows,
    amountLabel: amountLabelFor(booking?.status ?? null, payment.status),
    amount: payment.amount,
  });
  doc.save(`nexclean-receipt-${payment.orderId}.pdf`);
}
