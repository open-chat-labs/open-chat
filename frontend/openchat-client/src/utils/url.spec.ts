import { extractUrls } from "./url";

const testCases: { input: string, expectedUrls: string[] }[] = [{
    input: "",
    expectedUrls: []
}, {
    input: "https://oc.app",
    expectedUrls: ["https://oc.app"]
}, {
    input: "qwerty http://abc.co.uk! asdfgh",
    expectedUrls: ["http://abc.co.uk"]
}, {
    input: `aerugr "https://oc.app/blah-123" and https://oc.app/blah-123;`,
    expectedUrls: ["https://oc.app/blah-123"]
}, {
    input: "http://abc.com https://abc.org https://abc.xyz",
    expectedUrls: ["http://abc.com", "https://abc.org", "https://abc.xyz"]
}]

describe("extractUrls", () => {
    test("run test cases", () => {
        for (const { input, expectedUrls } of testCases) {
            const urls = extractUrls(input);
            expect(urls).toEqual(expectedUrls);
        }
    });
});
