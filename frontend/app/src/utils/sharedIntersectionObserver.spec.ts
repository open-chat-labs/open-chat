import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeIntersection } from "./sharedIntersectionObserver";

type Entry = { target: Element; time: number; isIntersecting: boolean };
type Cb = (entries: Entry[]) => void;

describe("observeIntersection", () => {
    const instances: { cb: Cb; init: IntersectionObserverInit; observed: Set<Element> }[] = [];

    beforeEach(() => {
        instances.length = 0;
        vi.stubGlobal(
            "IntersectionObserver",
            class {
                observed = new Set<Element>();
                constructor(
                    public cb: Cb,
                    public init: IntersectionObserverInit,
                ) {
                    instances.push(this);
                }
                observe(el: Element) {
                    this.observed.add(el);
                }
                unobserve(el: Element) {
                    this.observed.delete(el);
                }
                disconnect() {
                    this.observed.clear();
                }
            },
        );
    });
    afterEach(() => vi.unstubAllGlobals());

    it("shares one observer per config and dispatches the newest entry per target", () => {
        const a = {} as Element;
        const b = {} as Element;
        const seen: [string, boolean, number][] = [];
        const offA = observeIntersection(a, (e) => seen.push(["a", e.isIntersecting, e.time]));
        const offB = observeIntersection(b, (e) => seen.push(["b", e.isIntersecting, e.time]));
        expect(instances.length).toBe(1);

        instances[0].cb([
            { target: a, time: 1, isIntersecting: true },
            { target: b, time: 2, isIntersecting: false },
            { target: a, time: 3, isIntersecting: false },
            // equal time: the earlier entry wins, as with a stable sort
            { target: b, time: 2, isIntersecting: true },
        ] as Entry[]);
        expect(seen).toEqual([
            ["a", false, 3],
            ["b", false, 2],
        ]);

        offA();
        expect(instances[0].observed.has(a)).toBe(false);
        instances[0].cb([{ target: a, time: 4, isIntersecting: true }] as Entry[]);
        expect(seen.length).toBe(2);
        offB();
        offB();
        expect(instances[0].observed.size).toBe(0);
    });

    it("creates separate observers for different rootMargin/threshold", () => {
        // (the default config's observer already exists from the previous test —
        // observers are module-level and live for the page lifetime)
        const el = {} as Element;
        observeIntersection(el, () => {}, { threshold: 0.3 });
        observeIntersection(el, () => {}, { rootMargin: "10px 0px 10px 0px", threshold: 0 });
        observeIntersection(el, () => {}, { threshold: [0.1, 0.5] });
        observeIntersection(el, () => {}, { rootMargin: "10px 0px 10px 0px", threshold: 0 });
        expect(instances.length).toBe(3);
        expect(instances[1].init.rootMargin).toBe("10px 0px 10px 0px");
        expect(instances[2].init.threshold).toEqual([0.1, 0.5]);
    });

    it("keys a Document root separately from a null root", () => {
        const el = {} as Element;
        // jsdom is not loaded here; any Node instance stands in for a Document
        vi.stubGlobal("Node", class {});
        const fakeDoc = new (globalThis as unknown as { Node: new () => Node }).Node();
        const before = instances.length;
        observeIntersection(el, () => {}, { root: null, threshold: 0.7 });
        observeIntersection(el, () => {}, { root: fakeDoc as Document, threshold: 0.7 });
        expect(instances.length).toBe(before + 2);
        expect(instances[before].init.root).toBeNull();
        expect(instances[before + 1].init.root).toBe(fakeDoc);
    });

    it("isolates a throwing handler from the other targets in the batch", () => {
        const a = {} as Element;
        const b = {} as Element;
        const seen: string[] = [];
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        const before = instances.length;
        observeIntersection(a, () => {
            throw new Error("boom");
        }, { threshold: 0.9 });
        observeIntersection(b, () => seen.push("b"), { threshold: 0.9 });
        instances[before].cb([
            { target: a, time: 1, isIntersecting: true },
            { target: b, time: 1, isIntersecting: true },
        ] as Entry[]);
        expect(seen).toEqual(["b"]);
        expect(err).toHaveBeenCalledTimes(1);
        err.mockRestore();
    });
});
