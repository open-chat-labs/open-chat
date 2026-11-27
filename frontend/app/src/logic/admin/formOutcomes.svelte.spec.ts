import { i18nKey } from "@i18n/i18n";
import { FormOutcomes, formOutcomeKind } from "./formOutcomes.svelte";

const ok = { kind: "success" as const, message: i18nKey("Done") };
const failed = { kind: "failed" as const, message: i18nKey("Nope") };

describe("a form's outcome", () => {
    test("is proposed, not a success, for a dual-authorised action that went through", () => {
        expect(formOutcomeKind(ok, true)).toBe("proposed");
        expect(formOutcomeKind(ok, false)).toBe("success");
        expect(formOutcomeKind(failed, true)).toBe("failed");
    });

    test("is proposed for a success that turned into a proposal", () => {
        expect(formOutcomeKind({ ...ok, proposed: true }, false)).toBe("proposed");
    });

    test("is kept per form, with when it happened", () => {
        const outcomes = new FormOutcomes();
        outcomes.record("fees", ok, false, 1000);
        outcomes.record("nca", failed, true, 2000);
        expect(outcomes.of("fees")).toEqual({ kind: "success", message: ok.message, at: 1000 });
        expect(outcomes.of("nca")?.kind).toBe("failed");
        expect(outcomes.of("other")).toBeUndefined();
    });

    test("is cleared by an action that did nothing", () => {
        const outcomes = new FormOutcomes();
        outcomes.record("stake", failed);
        outcomes.record("stake", undefined);
        expect(outcomes.of("stake")).toBeUndefined();
    });

    test("is the action's, once it has run, and none while it runs", async () => {
        const outcomes = new FormOutcomes();
        outcomes.record("reviewers", failed);
        let resolve: (o: typeof ok) => void = () => undefined;
        const running = outcomes.run("reviewers", () => new Promise((r) => (resolve = r)), true);
        expect(outcomes.of("reviewers")).toBeUndefined();
        resolve(ok);
        await running;
        expect(outcomes.of("reviewers")?.kind).toBe("proposed");
    });
});
