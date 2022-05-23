import { overwriteUser } from "./user";

describe("overwrite users", () => {
    test("make sure that username is not overwritten if undefined", () => {
        const lookup = overwriteUser(
            {
                abc: {
                    kind: "user",
                    userId: "abc",
                    username: "julian_jelfs",
                    lastOnline: 10,
                    updated: BigInt(0),
                },
            },
            {
                kind: "user",
                userId: "abc",
                lastOnline: 20,
                username: undefined,
                updated: BigInt(0),
            }
        );
        expect(lookup["abc"].username).toEqual("julian_jelfs");
        expect(lookup["abc"].lastOnline).toEqual(20);
    });
});
