import type { CommandArg, CommandParam } from "@client";
import {
    dateInPast,
    argField,
    argFromChoice,
    argFromText,
    argText,
    choiceIndex,
    localDateTime,
} from "./commandArgs";

const common = { name: "p", required: true };
const text = (fields: { maxLength?: number; multi_line?: boolean } = {}): CommandParam => ({
    ...common,
    kind: "string",
    minLength: 0,
    maxLength: fields.maxLength ?? 100,
    choices: [],
    multi_line: fields.multi_line ?? false,
});
const integer = (minValue: bigint, maxValue: bigint): CommandParam => ({
    ...common,
    kind: "integer",
    minValue,
    maxValue,
    choices: [],
});

const topic: CommandParam = {
    ...common,
    kind: "string",
    minLength: 0,
    maxLength: 100,
    multi_line: false,
    name: "topic",
    choices: [
        { name: "Wallet", value: "wallet" },
        { name: "Diamond", value: "diamond" },
    ],
};

describe("how the arguments' form asks for a parameter", () => {
    test("by its choices, if it has some", () => {
        expect(argField(topic)).toEqual({ kind: "choice", names: ["Wallet", "Diamond"] });
    });

    test("else by its kind", () => {
        expect(argField(text({ maxLength: 50, multi_line: true }))).toEqual({
            kind: "text",
            multiLine: true,
            maxLength: 50,
        });
        expect(argField(integer(1n, 10n))).toEqual({
            kind: "number",
            step: "1",
            min: 1,
            max: 10,
        });
        expect(argField({ ...common, kind: "boolean" })).toEqual({ kind: "toggle" });
        expect(argField({ ...common, kind: "user" })).toEqual({ kind: "user" });
        expect(argField({ ...common, kind: "dateTime", future_only: true })).toEqual({
            kind: "date_time",
            futureOnly: true,
        });
    });

    test("a number field has no bound for a command's 'no limit'", () => {
        const amount: CommandParam = {
            ...common,
            kind: "decimal",
            minValue: 0,
            maxValue: Number.MAX_VALUE,
            choices: [],
        };
        expect(argField(amount)).toEqual({ kind: "number", step: "any", min: 0, max: undefined });
    });
});

// an argument's value, whatever its kind
const value = (arg: CommandArg) => ("value" in arg ? arg.value : undefined);

describe("a field's text as the argument", () => {
    test("text is the text", () => {
        const arg: CommandArg = { kind: "string", name: "q", value: "" };
        expect(argFromText(arg, "hello there")).toEqual({ ...arg, value: "hello there" });
        expect(argText({ ...arg, value: "hi" })).toBe("hi");
    });

    test("a whole number, or none for anything else", () => {
        const arg: CommandArg = { kind: "integer", name: "n", value: null };
        expect(argFromText(arg, " 42 ")).toEqual({ ...arg, value: 42n });
        expect(value(argFromText(arg, "4.2"))).toBeNull();
        expect(value(argFromText(arg, ""))).toBeNull();
        expect(argText({ ...arg, value: 7n })).toBe("7");
    });

    test("a number, or none for anything else", () => {
        const arg: CommandArg = { kind: "decimal", name: "x", value: null };
        expect(argFromText(arg, "1.5")).toEqual({ ...arg, value: 1.5 });
        expect(value(argFromText(arg, "abc"))).toBeNull();
        expect(value(argFromText(arg, ""))).toBeNull();
        expect(argText(arg)).toBe("");
    });

    test("a date and time in local time, both ways", () => {
        const arg: CommandArg = { kind: "dateTime", name: "at", value: null };
        const at = new Date(2026, 10, 16, 9, 30).getTime();
        expect(argFromText(arg, localDateTime(at))).toEqual({ ...arg, value: BigInt(at) });
        expect(argText({ ...arg, value: BigInt(at) })).toBe("2026-11-16T09:30");
        expect(value(argFromText(arg, ""))).toBeNull();
    });

    test("a date in the past is kept as typed, so the field still shows it", () => {
        const arg: CommandArg = { kind: "dateTime", name: "at", value: null };
        const past = new Date(2020, 0, 1, 9, 30).getTime();
        expect(argFromText(arg, localDateTime(past))).toEqual({ ...arg, value: BigInt(past) });
    });
});

describe("a choice as the argument", () => {
    const arg: CommandArg = { kind: "string", name: "topic", value: "" };

    test("is the choice's value", () => {
        expect(choiceIndex(topic, arg)).toBe(-1);
        const picked = argFromChoice(topic, arg, 1);
        expect(picked).toEqual({ ...arg, value: "diamond" });
        expect(choiceIndex(topic, picked)).toBe(1);
    });

    test("a number's choice is its number", () => {
        const level: CommandParam = {
            ...common,
            kind: "integer",
            minValue: 0n,
            maxValue: 10n,
            choices: [
                { name: "Low", value: 1n },
                { name: "High", value: 9n },
            ],
        };
        const n: CommandArg = { kind: "integer", name: "level", value: null };
        expect(argFromChoice(level, n, 1)).toEqual({ ...n, value: 9n });
    });
});

describe("a future-only date in the past", () => {
    const at = (future_only: boolean): CommandParam => ({
        ...common,
        kind: "dateTime",
        future_only,
    });
    const arg = (ms: number | null): CommandArg => ({
        kind: "dateTime",
        name: "p",
        value: ms === null ? null : BigInt(ms),
    });
    // 12:34:40
    const now = new Date(2026, 10, 19, 12, 34, 40).getTime();

    test("an earlier minute is in the past", () => {
        expect(dateInPast(at(true), arg(new Date(2026, 10, 19, 12, 33).getTime()), now)).toBe(true);
    });

    test("the current minute isn't, as the field's earliest pick is that minute", () => {
        expect(dateInPast(at(true), arg(new Date(2026, 10, 19, 12, 34).getTime()), now)).toBe(
            false,
        );
        expect(dateInPast(at(true), arg(new Date(2026, 10, 19, 12, 35).getTime()), now)).toBe(
            false,
        );
    });

    test("a date that was fine goes into the past as time passes", () => {
        const picked = arg(new Date(2026, 10, 19, 12, 35).getTime());
        expect(dateInPast(at(true), picked, now)).toBe(false);
        expect(dateInPast(at(true), picked, now + 2 * 60_000)).toBe(true);
    });

    test("no date, or a parameter that takes any date, never is", () => {
        expect(dateInPast(at(true), arg(null), now)).toBe(false);
        expect(dateInPast(at(false), arg(0), now)).toBe(false);
    });
});
