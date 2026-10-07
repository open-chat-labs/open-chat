import type { HintCaption } from "@client";
import { describe, expect, test } from "vitest";
import bridgesHints from "../../../openchat-shared/src/utils/dailyGames/bridgesHints.json";
import chatRoomsHints from "../../../openchat-shared/src/utils/dailyGames/chatRoomsHints.json";
import lightUpHints from "../../../openchat-shared/src/utils/dailyGames/lightUpHints.json";
import slantHints from "../../../openchat-shared/src/utils/dailyGames/slantHints.json";
import tentsHints from "../../../openchat-shared/src/utils/dailyGames/tentsHints.json";
import unrulyHints from "../../../openchat-shared/src/utils/dailyGames/unrulyHints.json";
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
            expect(def.id).toBe(id);
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

        const boardFor = (i: number) => def.newBoard(spec.description, spec.frames[i].marks);

        test(`${id} demo has frames and a caption on each`, () => {
            expect(spec.frames.length).toBeGreaterThan(1);
            for (const f of spec.frames) {
                expect(def.strings[f.caption]).toBeTruthy();
            }
        });

        test(`${id} demo ends on a solved grid`, () => {
            expect(boardFor(spec.frames.length - 1).solved).toBe(true);
        });

        test(`${id} demo shows at least one mistake going red`, () => {
            const withViolations = spec.frames.filter((_, i) => boardFor(i).violations.length > 0);
            expect(withViolations.length).toBeGreaterThan(0);
        });

        test(`${id} demo marks land on keys the game knows`, () => {
            const keys = new Set(def.newBoard(spec.description).elements.map((e) => e.key));
            for (const f of spec.frames) {
                for (const [k] of f.marks) expect(keys.has(k)).toBe(true);
                for (const k of f.target ?? []) expect(k).toBeGreaterThanOrEqual(0);
            }
        });
    }
});

// #9675 invariant 26: a hint sentence is built in code and worded in the strings, and nothing else
// ties the two. Every caption a game's hintCaption returns for a real solver step names a string
// the game ships, supplies every placeholder that string has, and names only strings that exist
// for the values it has translated first (a room's colour). The steps come from the fixtures the
// per-game "hint sentences" tests read, each kept current by its crate's hint_fixture_is_current.
describe("daily puzzle hint sentences match their strings", () => {
    type Step = { technique: number; focus: number[]; target: number[]; conclusions: number[][] };
    const fixtures: Record<string, { description: string; steps: Step[] }[]> = {
        chat_rooms: chatRoomsHints,
        light_up: lightUpHints,
        tents: tentsHints,
        slant: slantHints,
        bridges: bridgesHints,
        unruly: unrulyHints,
    };
    const bytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
    const placeholders = (text: string) =>
        [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();

    for (const [id, entries] of Object.entries(fixtures)) {
        test(`${id}: every caption names a string and fills its placeholders`, () => {
            const def = dailyPuzzleGames[id];
            let checked = 0;
            const check = (caption: HintCaption | undefined, where: string) => {
                if (caption === undefined) return;
                checked += 1;
                const text = def.strings[caption.key];
                expect(text, `${where}: ${caption.key}`).toBeDefined();
                const params = caption.params ?? {};
                // A placeholder with no value renders as raw text; a value the sentence has no
                // place for is harmless
                for (const name of placeholders(text)) {
                    expect(params, `${where}: ${caption.key} needs {${name}}`).toHaveProperty(name);
                }
                for (const value of Object.values(params)) {
                    if (typeof value === "object" && !Array.isArray(value)) {
                        expect(def.strings[value.key], `${where}: ${value.key}`).toBeDefined();
                    }
                }
            };
            for (const [p, entry] of entries.entries()) {
                const description = bytes(entry.description);
                const concluded: [number, number][] = [];
                for (const [i, step] of entry.steps.entries()) {
                    const where = `${id} puzzle ${p} step ${i}`;
                    const board = def.newBoard(description, concluded);
                    // As served with its target, and with it withheld
                    check(board.hintCaption(step), where);
                    check(board.hintCaption({ ...step, target: [] }), where);
                    for (const [k, v] of step.conclusions) concluded.push([k, v]);
                }
            }
            expect(checked).toBeGreaterThan(0);
        });
    }
});
