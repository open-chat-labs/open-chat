import { describe, expect, test } from "vitest";
import { isMainnet } from "./network";

describe("isMainnet", () => {
    test.each([
        "https://icp-api.io",
        "https://icp-api.io/",
        "http://icp-api.io",
        "https://ic0.app",
        "https://icp0.io",
        // Canister and boundary subdomains of the official domains are still mainnet
        "https://ic0.app.icp-api.io",
        "https://abcde-aaaaa-aaaaa-aaaaa-cai.raw.ic0.app",
    ])("recognises %s as mainnet", (url) => {
        expect(isMainnet(url)).toBe(true);
    });

    // Anything we do not recognise has to fetch its root key, so guessing wrong here is safe in
    // one direction only - a test network read as mainnet fails every certificate check, while a
    // mainnet URL read as a test network still works, just without the built-in root key
    test.each([
        "http://localhost:8080",
        "https://icp-api.test",
        "",
        "not a url",
        // A mainnet domain in the path, query or as a hostname suffix is not that domain
        "https://evil.test/icp-api.io",
        "https://evil.test?ref=ic0.app",
        "https://notic0.app",
    ])("does not treat %s as mainnet", (url) => {
        expect(isMainnet(url)).toBe(false);
    });
});
