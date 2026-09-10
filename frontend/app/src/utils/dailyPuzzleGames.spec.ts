import { describe, expect, test } from "vitest";
import en from "../i18n/en.json";
import { dailyPuzzleGames } from "./dailyPuzzleGames";

function flatten(obj: unknown, prefix = ""): Record<string, string> {
    const out: Record<string, string> = {};
    if (typeof obj !== "object" || obj === null) return out;
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix === "" ? k : `${prefix}.${k}`;
        if (typeof v === "string") out[key] = v;
        else Object.assign(out, flatten(v, key));
    }
    return out;
}

function lookup(obj: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

// Each game ships its strings as games/<game>/i18n.en.json; the copy under
// dailyPuzzle.games.<game> in en.json is the one the translation tooling sees.
describe("daily puzzle game strings", () => {
    for (const [id, def] of Object.entries(dailyPuzzleGames)) {
        test(`${id} strings match en.json under ${def.i18nPrefix}`, () => {
            expect(def.game.id).toBe(id);
            expect(flatten(lookup(en, def.i18nPrefix))).toEqual(def.strings);
            expect(def.strings.name).toBeTruthy();
            expect(def.strings.rules).toBeTruthy();
        });
    }
});

// The demos are the only teaching the pre-start screen does, and they are hand-built from raw
// description bytes, so nothing but a test stops one from quietly becoming wrong: a frame that
// no longer parses, a "finished" frame that does not actually solve, or a frame meant to show a
// mistake that the rule checker has stopped objecting to.
describe("daily puzzle demos", () => {
    for (const [id, def] of Object.entries(dailyPuzzleGames)) {
        const spec = def.demo;
        if (spec === undefined) continue;

        const model = def.game.parse(spec.description);
        const stateFor = (i: number) =>
            spec.frames[i].marks.reduce(
                (s, [k, v]) => def.game.apply(model, s, k, v),
                def.game.empty(model),
            );

        test(`${id} demo has frames and a caption on each`, () => {
            expect(spec.frames.length).toBeGreaterThan(1);
            for (const f of spec.frames) {
                expect(def.strings[f.caption]).toBeTruthy();
            }
        });

        test(`${id} demo ends on a solved grid`, () => {
            expect(def.game.solved(model, stateFor(spec.frames.length - 1))).toBe(true);
        });

        test(`${id} demo shows at least one mistake going red`, () => {
            const withViolations = spec.frames.filter(
                (_, i) => def.game.check(model, stateFor(i)).length > 0,
            );
            expect(withViolations.length).toBeGreaterThan(0);
        });

        test(`${id} demo marks land on keys the game knows`, () => {
            const keys = new Set(def.game.elements(model).map((e) => e.key));
            for (const f of spec.frames) {
                for (const [k] of f.marks) expect(keys.has(k)).toBe(true);
                for (const k of f.target ?? []) expect(k).toBeGreaterThanOrEqual(0);
            }
        });
    }
});
