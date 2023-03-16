import { processCachedEvents } from "./caching";

describe("processCachedEvents", () => {
    const cachedEvents = () => [
        { index: 0, event: { kind: "message" } },
        { index: 1, event: { kind: "message" } },
        { index: 2, event: { kind: "message" } },
        { index: 3, event: { kind: "message" } },
        { index: 4, event: { kind: "message" } },
        { index: 5, event: { kind: "message" } },
    ];
    function removeIdxs(
        events: { index: number; event: { kind: string } }[],
        idxs: number[]
    ): { index: number; event: { kind: string } }[] {
        return events.filter((e) => !idxs.includes(e.index));
    }

    function tests(ascending: boolean) {
        test("no cached events", () => {
            const [events, missing] = processCachedEvents(0, 100, ascending, []);
            expect(events).toEqual([]);
            expect(missing.size).toEqual(101);
        });

        test("events are in index order", () => {
            const [events, _] = processCachedEvents(0, 5, ascending, cachedEvents());
            for (let i = 0; i < 6; i++) {
                expect(events[i].index).toEqual(i);
            }
        });

        test("no missing events", () => {
            const [events, missing] = processCachedEvents(0, 5, ascending, cachedEvents());
            expect(events.length).toEqual(6);
            expect(missing.size).toEqual(0);
        });
        test("missing last", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(), [5])
            );
            expect(events.length).toEqual(5);
            expect(missing.size).toEqual(1);
        });
        test("missing first", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(), [0])
            );
            expect(events.length).toEqual(5);
            expect(missing.size).toEqual(1);
        });
        test("missing middle", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(), [1, 2, 3, 4])
            );
            expect(events.length).toEqual(2);
            expect(missing.size).toEqual(4);
        });
        test("one cached event", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(), [0, 1, 2, 4, 5])
            );
            expect(events.length).toEqual(1);
            expect(missing.size).toEqual(5);
        });
    }
    describe("descending", () => {
        tests(false);
    });
    describe("ascending", () => {
        tests(true);
    });
});
