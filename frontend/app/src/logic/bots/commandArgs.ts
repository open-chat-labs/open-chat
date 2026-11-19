import type { CommandArg, CommandParam } from "@client";

// A bot command's arguments as the arguments' form edits them: a field's text, a choice, a user, a
// toggle, each made into the argument the command takes (`CommandArg`), as the old trees' form
// (`CommandArg`) binds them.

/** The field a parameter is asked for with. */
export type ArgField =
    | { kind: "text"; multiLine: boolean; maxLength: number }
    | { kind: "number"; step: "1" | "any"; min: number | undefined; max: number | undefined }
    | { kind: "choice"; names: string[] }
    | { kind: "toggle" }
    | { kind: "user" }
    | { kind: "date_time"; futureOnly: boolean };

/** How the form asks for a parameter: its choices, if it has some, else by its kind. */
export function argField(param: CommandParam): ArgField {
    switch (param.kind) {
        case "string":
            return param.choices.length > 0
                ? { kind: "choice", names: param.choices.map((c) => c.name) }
                : { kind: "text", multiLine: param.multi_line, maxLength: param.maxLength };
        case "integer":
            return param.choices.length > 0
                ? { kind: "choice", names: param.choices.map((c) => c.name) }
                : {
                      kind: "number",
                      step: "1",
                      min: finite(Number(param.minValue)),
                      max: finite(Number(param.maxValue)),
                  };
        case "decimal":
            return param.choices.length > 0
                ? { kind: "choice", names: param.choices.map((c) => c.name) }
                : {
                      kind: "number",
                      step: "any",
                      min: finite(param.minValue),
                      max: finite(param.maxValue),
                  };
        case "boolean":
            return { kind: "toggle" };
        case "user":
            return { kind: "user" };
        case "dateTime":
            return { kind: "date_time", futureOnly: param.future_only };
    }
}

// a bound a number field can hold: none for the "no limit" a command gives as the largest number
function finite(n: number): number | undefined {
    return Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER ? n : undefined;
}

/** What a text, number or date field shows for its argument (a date in local time). */
export function argText(arg: CommandArg): string {
    switch (arg.kind) {
        case "string":
            return arg.value ?? "";
        case "integer":
        case "decimal":
            return arg.value === null ? "" : String(arg.value);
        case "dateTime":
            return arg.value === undefined || arg.value === null
                ? ""
                : localDateTime(Number(arg.value));
        default:
            return "";
    }
}

/**
 * The argument a text, number or date field's text makes; text that isn't a number or a date makes
 * none, as does a date before `notBefore` (now, for a parameter that takes only future dates).
 */
export function argFromText(arg: CommandArg, text: string, notBefore?: number): CommandArg {
    const typed = text.trim();
    switch (arg.kind) {
        case "string":
            return { ...arg, value: text };
        case "integer":
            return { ...arg, value: /^-?\d+$/.test(typed) ? BigInt(typed) : null };
        case "decimal": {
            const n = typed === "" ? NaN : Number(typed);
            return { ...arg, value: Number.isNaN(n) ? null : n };
        }
        case "dateTime": {
            const at = typed === "" ? NaN : new Date(typed).getTime();
            const past = notBefore !== undefined && at < notBefore;
            return { ...arg, value: Number.isNaN(at) || past ? null : BigInt(at) };
        }
        default:
            return arg;
    }
}

/** Which of its parameter's choices an argument is (-1 for none yet). */
export function choiceIndex(param: CommandParam, arg: CommandArg): number {
    switch (param.kind) {
        case "string":
            return arg.kind === "string"
                ? param.choices.findIndex((c) => c.value === arg.value)
                : -1;
        case "integer":
            return arg.kind === "integer"
                ? param.choices.findIndex((c) => c.value === arg.value)
                : -1;
        case "decimal":
            return arg.kind === "decimal"
                ? param.choices.findIndex((c) => c.value === arg.value)
                : -1;
        default:
            return -1;
    }
}

/** The argument a choice picked makes. */
export function argFromChoice(param: CommandParam, arg: CommandArg, index: number): CommandArg {
    if (param.kind === "string" && arg.kind === "string") {
        return { ...arg, value: param.choices[index]?.value ?? arg.value };
    }
    if (param.kind === "integer" && arg.kind === "integer") {
        return { ...arg, value: param.choices[index]?.value ?? arg.value };
    }
    if (param.kind === "decimal" && arg.kind === "decimal") {
        return { ...arg, value: param.choices[index]?.value ?? arg.value };
    }
    return arg;
}

/** A time (ms) as a date and time field holds it, in local time. */
export function localDateTime(ms: number): string {
    const d = new Date(ms);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}
