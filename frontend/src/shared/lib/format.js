/** Shared date/money/time formatting helpers used across modules. */
export function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}
export function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
    });
}
export function formatMoney(value) {
    return `₹${(value ?? 0).toLocaleString("en-IN")}`;
}
export function greeting() {
    const h = new Date().getHours();
    if (h < 12)
        return "Good morning";
    if (h < 17)
        return "Good afternoon";
    return "Good evening";
}
