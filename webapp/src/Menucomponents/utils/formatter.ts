export function formatTime(seconds?: number | null): string {
    if (seconds == null) return "N/A";

    const minutes = Math.round(seconds / 60);
    return minutes < 60
        ? `${minutes}\u202Fmin`
        : `${Math.floor(minutes / 60)}\u202Fhr ${minutes % 60}\u202Fmin`;
}

export function formatDistance(metres?: number | null): string {
    return metres == null ? "N/A" : `${(metres / 1000).toFixed(2)}\u202Fkm`;
}