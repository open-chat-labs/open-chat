import { enoughVisibleMessages } from "./chat";

// FIXME - we can't test this because it uses an fn imported from shared which we have to stub for now
describe.skip("enough visible messages", () => {
    test("returns false when there are no messages", () => {
        console.log("hello there");
        expect(enoughVisibleMessages(true, [0, 1000], [])).toBe(false);
    });
});
