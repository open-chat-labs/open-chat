import { withoutQueryStringParams, withQueryStringFlag } from "./urls";

describe("query string helpers", () => {
    afterEach(() => history.replaceState(null, "", "/"));

    test("add a valueless param, keeping the others", () => {
        history.replaceState(null, "", "/chats?keep=1");
        expect(withQueryStringFlag("profile")).toBe("/chats?keep=1&profile");
        history.replaceState(null, "", "/chats");
        expect(withQueryStringFlag("profile")).toBe("/chats?profile");
    });

    test("don't add a param twice", () => {
        history.replaceState(null, "", "/chats?profile");
        expect(withQueryStringFlag("profile")).toBe("/chats?profile");
    });

    test("drop several params at once", () => {
        history.replaceState(null, "", "/chats?everyone&usergroup=3&keep=1");
        expect(withoutQueryStringParams(["everyone", "usergroup"])).toBe("/chats?keep=1");
        expect(withoutQueryStringParams(["everyone", "usergroup", "keep"])).toBe("/chats");
    });
});
