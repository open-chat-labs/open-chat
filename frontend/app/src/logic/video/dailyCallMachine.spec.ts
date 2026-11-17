import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { DAILY_CALL_MACHINE_VERSION } from "./dailyCallMachine";

describe("Daily's call machine", () => {
    // #10124: the call machine served from our origin is the one for the daily-js the app runs; a
    // daily-js upgrade that left the pin behind would load an older call machine into a newer client
    test("the pinned call machine is the installed daily-js's version", () => {
        const pkg = JSON.parse(
            readFileSync(
                path.join(process.cwd(), "node_modules/@daily-co/daily-js/package.json"),
                "utf8",
            ),
        ) as { version: string };
        expect(DAILY_CALL_MACHINE_VERSION).toEqual(pkg.version);
    });
});
