type Props = {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};
export declare function Pagination({ page, totalPages, onPageChange }: Props): import("react").JSX.Element | null;
export {};
