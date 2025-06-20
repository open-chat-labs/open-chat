import { dimensionsWidth } from "openchat-client";

const MAX_HEIGHT = 1000;

class PreviewDimensionsObserver {
    #observer: ResizeObserver;
    #dimensions: Map<string, [number, number]> = new Map();
    #elementUrls: Map<Element, string> = new Map();

    constructor() {
        this.#observer = new ResizeObserver((entries) => {
            for (const e of entries) {
                const element = e.target;
                if (0 < element.clientHeight && element.clientHeight <= MAX_HEIGHT) {
                    const url = this.#elementUrls.get(e.target);
                    if (url) {
                        this.#dimensions.set(url, [element.clientHeight, element.clientWidth]);
                    }
                }
            }
        });
        dimensionsWidth.subscribe((_) => this.#dimensions.clear());
    }

    getDimensions(url: string): [number, number] | undefined {
        return this.#dimensions.get(url);
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

export const previewDimensionsObserver = new PreviewDimensionsObserver();
