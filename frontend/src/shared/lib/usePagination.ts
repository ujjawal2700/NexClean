import { useMemo, useState } from "react";

/** Client-side pagination over an already-fetched list. Resets to page 1 whenever the list reference changes. */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );
  return { page: safePage, totalPages, setPage, pageItems };
}
