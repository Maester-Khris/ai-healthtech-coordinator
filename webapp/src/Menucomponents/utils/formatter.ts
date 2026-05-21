export function formatTime(seconds?: number | null): string {
    if (seconds == null) return "N/A";

    const minutes = Math.round(seconds / 60);
    return minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function formatDistance(metres?: number | null): string {
    return metres == null ? "N/A" : `${(metres / 1000).toFixed(2)} km`;
}
