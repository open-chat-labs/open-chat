import { dimensionsWidth } from "openchat-client";

const MAX_HEIGHT = 1000;

class PreviewHeightObserver {
    #observer: ResizeObserver;
    #heights: Map<string, number> = new Map();
    #elementUrls: Map<Element, string> = new Map();

    constructor() {
        this.#observer = new ResizeObserver((entries) => {
            for (const e of entries) {
                const element = e.target;
                if (0 < element.clientHeight && element.clientHeight <= MAX_HEIGHT) {
                    const url = this.#elementUrls.get(e.target);
                    if (url) {
                        this.#heights.set(url, element.clientHeight);
                    }
                }
            }
        });
        dimensionsWidth.subscribe((_) => this.#heights.clear());
    }

    getHeight(url: string): number | undefined {
        return this.#heights.get(url);
    }

    observe(element: Element, url: string) {
        this.#observer.observe(element);
        this.#elementUrls.set(element, url);
    }

    unobserve(element: Element) {
        this.#observer.unobserve(element);
        this.#elementUrls.delete(element);
    }
}

export const previewHeightObserver = new PreviewHeightObserver();
