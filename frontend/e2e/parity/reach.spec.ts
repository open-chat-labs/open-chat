import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { classMembers, reach, reachReport } from "./reach.mjs";

function tree(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), "reach-"));
    for (const [name, text] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        writeFileSync(path.join(root, name), text);
    }
    return root;
}

describe("the reach report (#10554)", () => {
    test("invariant 1 (#10550): a member only the old trees call is a gap until acknowledged; one the new trees reach through shared code isn't", () => {
        const root = tree({
            "openchat.ts": `export class OpenChat {
                constructor() {}
                sendMessage() {}
                tipMessage() {}
                get user() { return 1; }
                #secret() {}
                private hidden() {}
            }`,
            "old/App.svelte": `<script>import "./Tip.svelte"; import { send } from "@logic/send";</script>`,
            "old/Tip.svelte": `<script>client.tipMessage(); client.hidden();</script>`,
            "new/App.svelte": `<script>const Send = import("@logic/send");</script>`,
            "logic/send.ts": `export const send = () => client?.sendMessage() && client.user;`,
        });
        const members = classMembers(
            readFileSync(path.join(root, "openchat.ts"), "utf8"),
            "OpenChat",
        );
        expect([...members].sort()).toEqual(["sendMessage", "tipMessage", "user"]);

        const options = {
            members,
            aliases: [{ prefix: "@logic/", to: path.join(root, "logic") }],
            roots: [root],
            base: root,
        };
        const old = reach(path.join(root, "old/App.svelte"), options);
        const fresh = reach(path.join(root, "new/App.svelte"), options);
        const byTree = { v1: old, v2: old, "v3 desktop": fresh, "v3 mobile": fresh };

        const report = reachReport(byTree, {});
        expect(report.gaps.map(([m]) => m)).toEqual(["tipMessage"]);
        expect(report.gaps[0][1].at).toBe("old/Tip.svelte:1");

        const acknowledged = reachReport(byTree, {
            tipMessage: { reason: "not yet", decided: "test" },
        });
        expect(acknowledged.gaps).toEqual([]);
        expect(acknowledged.acknowledged.map(([m]) => m)).toEqual(["tipMessage"]);
    });
});
