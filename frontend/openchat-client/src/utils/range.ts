import type DRange from "drange";

export function indexIsInRanges(index: number, ranges: DRange): boolean {
    for (const range of ranges.subranges()) {
        if (range.low <= index && index <= range.high) return true;
        if (range.low > index) break;
    }
    return false;
}
