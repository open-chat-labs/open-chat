import { dimensionsWidth } from "openchat-client";

const MAX_HEIGHT = 1000;

const previewHeights = new Map<string, number>();

export function getPreviewHeight(url: string): number | undefined {
    return previewHeights.get(url);
}

export function recordPreviewHeight(url: string, height: number) {
    if (height <= MAX_HEIGHT) {
        previewHeights.set(url, height);
    } else {
        previewHeights.delete(url);
    }
}

dimensionsWidth.subscribe((_) => previewHeights.clear());
