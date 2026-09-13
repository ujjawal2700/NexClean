import * as XLSX from "xlsx";

/**
 * Exports an array of flat row objects to a real .xlsx workbook and triggers a
 * browser download. Column order follows each object's own key order, so
 * callers should build rows as `{ "Order ID": …, "Customer": … }` — the keys
 * become the header row verbatim.
 */
export function exportRowsToExcel(rows: Record<string, string | number>[], filename: string, sheetName = "Sheet1") {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
