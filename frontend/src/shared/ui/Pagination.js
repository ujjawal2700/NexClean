import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
export function Pagination({ page, totalPages, onPageChange }) {
    if (totalPages <= 1)
        return null;
    return (_jsxs("div", { className: "mt-4 flex items-center justify-between border-t border-line/70 pt-3", children: [_jsxs("p", { className: "text-xs text-muted", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", disabled: page <= 1, onClick: () => onPageChange(page - 1), children: [_jsx(ChevronLeft, { className: "size-4" }), " Prev"] }), _jsxs(Button, { variant: "outline", size: "sm", disabled: page >= totalPages, onClick: () => onPageChange(page + 1), children: ["Next ", _jsx(ChevronRight, { className: "size-4" })] })] })] }));
}
