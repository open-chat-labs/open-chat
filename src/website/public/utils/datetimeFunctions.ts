
export function toShortTime(datetime: Date) : string {
    return datetime.toLocaleTimeString("en", {"hour": "2-digit", "minute": "2-digit", "hour12": false});
}