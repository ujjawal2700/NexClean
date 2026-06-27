import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3">
      <p className="text-xs text-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
