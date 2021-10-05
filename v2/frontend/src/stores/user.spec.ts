import { overwriteUser } from "./user";

describe("overwrite users", () => {
    test("make sure that username is not overwritten if undefined", () => {
        const lookup = overwriteUser(
            {
                abc: {
                    userId: "abc",
                    username: "julian_jelfs",
                    secondsSinceLastOnline: 10,
                },
            },
            {
                userId: "abc",
                secondsSinceLastOnline: 20,
                username: undefined,
            }
        );
        expect(lookup["abc"].username).toEqual("julian_jelfs");
        expect(lookup["abc"].secondsSinceLastOnline).toEqual(20);
    });
});
