import { describe, expect, test } from "vitest";
import { protect, restore, toBcp47 } from "./onDeviceTranslation";

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
        const { text, tokens } = protect(original);
        expect(text).toEqual("Salut [0], regarde [1] et lance [2]");
        expect(tokens).toEqual(["@UserId(abc-123)", "https://oc.app/faq", "`npm run dev`"]);
        expect(restore("Hi [0], look at [1] and run [2]", tokens)).toEqual(
            "Hi @UserId(abc-123), look at https://oc.app/faq and run `npm run dev`",
        );
    });

    test("gives up rather than showing a mangled placeholder", () => {
        const { tokens } = protect("Salut @UserId(abc)");
        expect(restore("Hi (0)", tokens)).toBeUndefined();
    });

    test("restore leaves tokens containing replacement patterns intact", () => {
        const tokens = ["https://x.com/$&"];
        expect(restore("see [0]", tokens)).toEqual("see https://x.com/$&");
    });
});
