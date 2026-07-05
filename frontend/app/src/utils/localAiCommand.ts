// The generic "/ai <prompt>" composer command: runs the user's selected ON-DEVICE model with the
// typed prompt and hands the reply back for the composer to post. Fully generic — nothing here is
// app-specific; it is just a thin, testable wrapper over the on-device inference facade so any
// client build gains a direct "chat with the local model" affordance decoupled from the AI-action
// (propose/confirm) flow. The model runs entirely on-device; the prompt never leaves the machine.

import { inferOnDevice } from "./onDeviceInference";

// A leading /ai command, with everything after it captured as the prompt. Case-insensitive so
// "/AI" works too. The prompt may span lines (Shift+Enter in the composer).
const AI_COMMAND = /^\/ai(?:\s+([\s\S]+))?$/i;

// Bound the reply length so a runaway generation can't hang the composer. Generous enough for a
// normal chat answer (~350 words); tune if longer replies are wanted.
const MAX_REPLY_TOKENS = 512;

// True when `input` STARTS an /ai command (even before a prompt is typed). The composer uses this to
// suppress the bot-command selector so the input is routed through the normal send path instead.
export function isLocalAiCommandPrefix(input: string): boolean {
    return /^\/ai(\s|$)/i.test(input.trimStart());
}

// The prompt text of a complete "/ai <prompt>" command, or undefined when `input` is not an /ai
// command or carries no prompt (bare "/ai").
export function parseLocalAiCommand(input: string): string | undefined {
    const match = input.trim().match(AI_COMMAND);
    if (match === null) return undefined;
    const prompt = (match[1] ?? "").trim();
    return prompt.length > 0 ? prompt : undefined;
}

export type LocalAiResult =
    | { kind: "ok"; reply: string }
    // The on-device model can't run here (plain web/PWA build, or no model downloaded/selected).
    | { kind: "unavailable"; reason: string }
    | { kind: "error"; error: string };

export async function runLocalAiCommand(prompt: string): Promise<LocalAiResult> {
    const result = await inferOnDevice({ prompt, maxTokens: MAX_REPLY_TOKENS });
    switch (result.kind) {
        case "ok":
            return { kind: "ok", reply: result.text.trim() };
        case "unavailable":
            return { kind: "unavailable", reason: result.reason };
        default:
            return { kind: "error", error: result.error };
    }
}
