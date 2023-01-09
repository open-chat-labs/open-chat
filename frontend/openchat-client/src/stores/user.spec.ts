import { overwriteUser } from "./user";

describe("overwrite users", () => {
    test("make sure that username is not overwritten if undefined", () => {
        const lookup = overwriteUser(
            {
                abc: {
                    kind: "user",
                    userId: "abc",
                    username: "julian_jelfs",
                    updated: BigInt(0),
                    suspended: false,
                },
            },
            {
                kind: "user",
                userId: "abc",
                username: undefined,
                updated: BigInt(0),
                suspended: false,
            }
        );
        expect(lookup["abc"].username).toEqual("julian_jelfs");
    });
});
