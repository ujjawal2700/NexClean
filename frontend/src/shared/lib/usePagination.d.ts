/** Client-side pagination over an already-fetched list. Resets to page 1 whenever the list reference changes. */
export declare function usePagination<T>(items: T[], pageSize: number): {
    page: number;
    totalPages: number;
    setPage: import("react").Dispatch<import("react").SetStateAction<number>>;
    pageItems: T[];
};
