import { describe, expect, test } from "vitest";
import { localUrl } from "./local.mjs";

describe("the e2e suite's target (#10550)", () => {
    test("invariant 4: the suite never targets a host other than this machine", () => {
        expect(localUrl("http://localhost:5011")).toBe("http://localhost:5011");
        expect(localUrl("http://127.0.0.1:5011")).toBe("http://127.0.0.1:5011");
        expect(() => localUrl("https://oc.app")).toThrow();
        expect(() => localUrl("https://webtest.oc.app")).toThrow();
    });
});
