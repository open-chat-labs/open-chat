import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

// #9455 invariant 10: the website joins an audio call with the camera off whatever the
// videoCameraOn setting says, in both layouts.
//
// The two rules, startVideoOff and joinedCallType, are tested as pure functions in
// openchat-shared. That says nothing about whether ActiveCall uses them, and ActiveCall cannot
// be mounted in a test because it builds a Daily iframe. So this reads the two components and
// fails if either stops passing the call through the rules. It is a crude test. It is here
// because review found that removing either call from either component failed nothing.
const components = [
    "../components/home/video/ActiveCall.svelte",
    "../components_mobile/home/video/ActiveCall.svelte",
].map((path) => ({
    path,
    source: readFileSync(resolve(__dirname, path), "utf8").replace(/\s+/g, " "),
}));

describe.each(components)("invariant 10 wiring: $path", ({ source }) => {
    test("the camera setting reaches Daily only through startVideoOff", () => {
        expect(source).toContain("startVideoOff: startVideoOff(callType, $videoCameraOn)");
        expect(source.match(/\$videoCameraOn/g)).toHaveLength(1);
    });

    test("a join takes the type of the call in progress before anything else uses callType", () => {
        const join = source.indexOf(
            "if (join) { callType = joinedCallType( callType, client.lookupChatSummary(chatId)?.videoCallInProgress?.callType, ); }",
        );
        expect(join).toBeGreaterThan(-1);
        expect(join).toBeLessThan(source.indexOf("activeVideoCall.joining(chatId, callType)"));
        expect(join).toBeLessThan(source.indexOf("confirmSwitchTo = { chatId, callType, join }"));
    });
});
