import { flushSync } from "svelte";
import { describe, expect, test, vi } from "vitest";
import { onDeviceTranslator, protect, restore, toBcp47 } from "./onDeviceTranslation.svelte";

describe("onDeviceTranslation", () => {
    test("maps our locale codes to BCP 47", () => {
        expect(toBcp47("cn")).toEqual("zh");
        expect(toBcp47("iw")).toEqual("he");
        expect(toBcp47("jp")).toEqual("ja");
        expect(toBcp47("fr")).toEqual("fr");
        expect(toBcp47("en-GB")).toEqual("en");
        expect(toBcp47(undefined)).toEqual("en");
    });

    test("protects mentions, urls and code from the translator", () => {
        const original =
            "Salut @UserId(abc-123), regarde https://oc.app/faq et lance `npm run dev`";
        const p = protect(original)!;
        expect(p.text).toEqual("Salut [0], regarde [1] et lance [2]");
        expect(p.tokens).toEqual(["@UserId(abc-123)", "https://oc.app/faq", "`npm run dev`"]);
        expect(restore("Hi [0], look at [1] and run [2]", p)).toEqual(
            "Hi @UserId(abc-123), look at https://oc.app/faq and run `npm run dev`",
        );
    });

    test("gives up rather than showing a mangled placeholder", () => {
        const p = protect("Salut @UserId(abc)")!;
        expect(restore("Hi (0)", p)).toBeUndefined();
    });

    test("restore leaves tokens containing replacement patterns intact", () => {
        const p = protect("voir https://x.com/$&")!;
        expect(restore("see [0]", p)).toEqual("see https://x.com/$&");
    });

    test("avoids placeholders that collide with literal text", () => {
        const p = protect("[1] Salut @UserId(a) voir https://oc.app")!;
        expect(p.text).toEqual("[1] Salut {0} voir {1}");
        expect(restore("[1] Hi {0} see {1}", p)).toEqual("[1] Hi @UserId(a) see https://oc.app");
    });

    // Invariant: a message's enqueue effect doesn't depend on translator state, so translating
    // one message doesn't re-run (cancel and re-enqueue) the effect of every other rendered message
    test("translating one message does not re-run another message's enqueue effect", () => {
        vi.useFakeTimers();
        let runs = 0;
        const cleanup = $effect.root(() => {
            $effect(() => {
                runs++;
                onDeviceTranslator.enqueue(1n, 1, "bonjour tout le monde");
                return () => onDeviceTranslator.cancel(1n);
            });
        });
        try {
            flushSync();
            onDeviceTranslator.translations.set(2n, { source: "hola", text: "hello", from: "es" });
            onDeviceTranslator.waiting.set(3n, "de");
            flushSync();
            expect(runs).toEqual(1);
        } finally {
            cleanup();
            onDeviceTranslator.translations.clear();
            onDeviceTranslator.waiting.clear();
            vi.useRealTimers();
        }
    });
});
