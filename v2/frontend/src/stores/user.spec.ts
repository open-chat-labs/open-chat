import { overwriteUser } from "./user";

describe("overwrite users", () => {
    test("make sure that username is not overwritten if undefined", () => {
        const lookup = overwriteUser(
            {
                abc: {
                    userId: "abc",
                    username: "julian_jelfs",
                    lastOnline: 10,
                },
            },
            {
                userId: "abc",
                lastOnline: 20,
                username: undefined,
            }
        );
        expect(lookup["abc"].username).toEqual("julian_jelfs");
        expect(lookup["abc"].lastOnline).toEqual(20);
    });
});
