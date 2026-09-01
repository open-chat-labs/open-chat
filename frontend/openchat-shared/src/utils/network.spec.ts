import { describe, expect, test } from "vitest";
import { isMainnet } from "./network";

describe("isMainnet", () => {
    test.each([
        "https://icp-api.io",
        "https://icp-api.io/",
        "http://icp-api.io",
        "https://ic0.app.icp-api.io",
    ])("recognises %s as mainnet", (url) => {
        expect(isMainnet(url)).toBe(true);
    });

    // Anything we do not recognise has to fetch its root key, so guessing wrong here is safe in
    // one direction only - a test network read as mainnet fails every certificate check
    test.each(["http://localhost:8080", "https://ic0.app", "https://icp-api.test", ""])(
        "does not treat %s as mainnet",
        (url) => {
            expect(isMainnet(url)).toBe(false);
        },
    );
});
