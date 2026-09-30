import { describe, expect, test } from "vitest";
import { languageCode } from "./i18n";

describe("languageCode", () => {
    test.each([
        ["fr", "fr"],
        ["fr-CA", "fr"],
        ["zh-Hant-TW", "zh"],
        // our codes are taken as they are, "iw" being the deprecated code for Hebrew
        ["iw", "iw"],
        ["cn", "cn"],
        [null, "en"],
        [undefined, "en"],
        ["", "en"],
    ])("%s is a locale of the language %s", (locale, language) => {
        expect(languageCode(locale)).toBe(language);
    });
});
