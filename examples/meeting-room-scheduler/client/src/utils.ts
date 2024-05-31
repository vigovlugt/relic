export function formatDate(date: Date) {
    return Intl.DateTimeFormat(undefined, {
        year: "2-digit",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}
