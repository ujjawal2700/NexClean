import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const XLSX = createRequire(new URL("../../frontend/package.json", import.meta.url))("xlsx");

test("patched SheetJS preserves exported columns, numbers and Unicode on a workbook roundtrip", () => {
  const rows = [{ "Order ID": "NC-001", Customer: "इंदौर Cleaner", Amount: 1250, Address: "Indore" }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Bookings");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const restored = XLSX.read(bytes, { type: "buffer" });
  expect(restored.SheetNames).toEqual(["Bookings"]);
  expect(XLSX.utils.sheet_to_json(restored.Sheets.Bookings)).toEqual(rows);
});
