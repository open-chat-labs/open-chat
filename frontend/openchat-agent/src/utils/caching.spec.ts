import { MAX_EVENTS, MAX_MESSAGES } from "../constants";
import { processCachedEvents, processCachedEventsWindow } from "./caching";

function largeTest() {
    const events = [];
    for (let i = 100; i < MAX_EVENTS; i++) {
        const kind = i < MAX_MESSAGES + 100 ? "message" : "reaction";
        events.push({ index: i, event: { kind } });
    }
    return events;
}

const cachedEvents = (from: number, to: number) => {
    const events = [];
    for (let i = from; i <= to; i++) {
        events.push({ index: i, event: { kind: "message" } });
    }
    return events;
};

function removeIdxs(
    events: { index: number; event: { kind: string } }[],
    idxs: number[]
): { index: number; event: { kind: string } }[] {
    return events.filter((e) => !idxs.includes(e.index));
}

describe("processCachedEventsWindow", () => {
    test("no missing events, even range", () => {
        const [events, missing] = processCachedEventsWindow(0, 5, 3, cachedEvents(0, 5));
        expect(events.length).toEqual(6);
        expect(missing.size).toEqual(0);
    });
    test("no missing events, odd range", () => {
        const [events, missing] = processCachedEventsWindow(1, 5, 3, cachedEvents(1, 5));
        expect(events.length).toEqual(5);
        expect(missing.size).toEqual(0);
    });
    test("odd range, missing middle", () => {
        const [events, missing] = processCachedEventsWindow(
            1,
            5,
            2,
            removeIdxs(cachedEvents(1, 5), [3])
        );
        expect(events.length).toEqual(4);
        expect(missing.size).toEqual(1);
    });
    test("hit limit early", () => {
        const [events, missing] = processCachedEventsWindow(100, MAX_EVENTS - 1, 300, largeTest());
        expect(events.length).toEqual(400);
        expect(missing.size).toEqual(0);
    });
});

describe("processCachedEvents", () => {
    function tests(ascending: boolean) {
        test("hit message limit early", () => {
            const [events, missing] = processCachedEvents(
                100,
                MAX_EVENTS - 1,
                ascending,
                largeTest()
            );
            expect(events.length).toEqual(ascending ? 100 : 400);
            expect(missing.size).toEqual(0);
        });

        test("no cached events", () => {
            const [events, missing] = processCachedEvents(0, 100, ascending, []);
            expect(events).toEqual([]);
            expect(missing.size).toEqual(101);
        });

        test("events are in index order", () => {
            const [events, _] = processCachedEvents(0, 5, ascending, cachedEvents(0, 5));
            for (let i = 0; i < 6; i++) {
                expect(events[i].index).toEqual(i);
            }
        });

        test("no missing events", () => {
            const [events, missing] = processCachedEvents(0, 5, ascending, cachedEvents(0, 5));
            expect(events.length).toEqual(6);
            expect(missing.size).toEqual(0);
        });
        test("missing last", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(0, 5), [5])
            );
            expect(events.length).toEqual(5);
            expect(missing.size).toEqual(1);
        });
        test("missing first", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(0, 5), [0])
            );
            expect(events.length).toEqual(5);
            expect(missing.size).toEqual(1);
        });
        test("missing middle", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(0, 5), [1, 2, 3, 4])
            );
            expect(events.length).toEqual(2);
            expect(missing.size).toEqual(4);
        });
        test("one cached event", () => {
            const [events, missing] = processCachedEvents(
                0,
                5,
                ascending,
                removeIdxs(cachedEvents(0, 5), [0, 1, 2, 4, 5])
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
