import { chainAt, chainBack, chainOpened, sameUrl, type Chain } from "./linkedDialogs.svelte";

const CHIT = "/chats?chit";
const HOF = "/chats?hof";
const PROFILE = "/chats?profile=chit";

describe("a chain of dialogs opened one from another", () => {
    test("each one opened from the last has the last behind it, A → B → C", () => {
        const b = chainOpened(undefined, CHIT, PROFILE);
        expect(b).toEqual({ behind: [CHIT], at: PROFILE, reached: false });
        const c = chainOpened(chainAt(b, PROFILE), PROFILE, HOF);
        expect(c).toEqual({ behind: [CHIT, PROFILE], at: HOF, reached: false });
    });

    test("the back arrow goes back a step at a time, C → B → A, and A has nothing behind", () => {
        const c: Chain = { behind: [CHIT, PROFILE], at: HOF, reached: true };
        const toB = chainBack(c);
        expect(toB).toEqual({
            to: PROFILE,
            chain: { behind: [CHIT], at: PROFILE, reached: false },
        });
        const toA = chainBack(toB?.chain);
        expect(toA).toEqual({ to: CHIT, chain: undefined });
        expect(chainBack(toA?.chain)).toBeUndefined();
    });

    test("opening one already behind goes back to it rather than going round", () => {
        // the CHIT dialog opened from the profile it had opened
        const b: Chain = { behind: [CHIT], at: PROFILE, reached: true };
        expect(chainOpened(b, PROFILE, CHIT)).toBeUndefined();
        const c: Chain = { behind: [CHIT, PROFILE], at: HOF, reached: true };
        expect(chainOpened(c, HOF, PROFILE)).toEqual({
            behind: [CHIT],
            at: PROFILE,
            reached: false,
        });
    });

    test("is kept on its way to its URL and while it shows, and gone once the URL leaves it (closed, Back, a link)", () => {
        const b = chainOpened(undefined, CHIT, PROFILE);
        // the URL told again as it was, before the navigation lands
        expect(chainAt(b, CHIT)).toBe(b);
        const reached = chainAt(b, PROFILE);
        expect(reached).toEqual({ behind: [CHIT], at: PROFILE, reached: true });
        expect(chainAt(reached, "/chats")).toBeUndefined();
    });

    test("a dialog opened from one the chain no longer shows starts a new chain", () => {
        const stale: Chain = { behind: [CHIT], at: PROFILE, reached: true };
        expect(chainOpened(stale, CHIT, HOF)).toEqual({ behind: [CHIT], at: HOF, reached: false });
    });
});

describe("the same URL", () => {
    test("is the same path and query once parsed, flags with or without =", () => {
        expect(sameUrl("/chats?threads&chit", "/chats?threads=&chit")).toBe(true);
        expect(sameUrl("/chats?chit&threads", "/chats?threads=&chit")).toBe(true);
        expect(sameUrl("/chats?chit", "/chats?chit=earn")).toBe(false);
        expect(sameUrl("/chats?chit", "/communities?chit")).toBe(false);
    });

    test("so another flag in the URL still finds the dialog behind", () => {
        const b = chainOpened(undefined, "/chats?threads&chit", "/chats?threads&hof");
        expect(chainAt(b, "/chats?threads=&hof")?.reached).toBe(true);
    });
});
