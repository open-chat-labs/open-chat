/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { UserSearchContext, userSearchMachine } from "./userSearch.machine";
import { testTransition } from "./machine.spec.utils";
import type { ServiceContainer } from "../services/serviceContainer";

const testContext: UserSearchContext = {
    serviceContainer: {} as ServiceContainer,
    searchTerm: "",
    users: [],
};

describe("user search machine transitions", () => {
    test("on text input", () => {
        const ctx = testTransition(
            userSearchMachine.withContext(testContext),
            "idle",
            { type: "ON_INPUT", data: "some text" },
            "searching_users"
        );

        expect(ctx.searchTerm).toEqual("some text");
    });
    test("clear", () => {
        const ctx = testTransition(
            userSearchMachine.withContext({
                ...testContext,
                searchTerm: "testing123",
            }),
            "idle",
            "CLEAR",
            "idle"
        );

        expect(ctx.searchTerm).toEqual("");
    });
    test("select user", () => {
        testTransition(
            userSearchMachine.withContext(testContext),
            "idle",
            {
                type: "SELECT_USER",
                data: { userId: "a", username: "julian_jelfs", secondsSinceLastOnline: 0 },
            },
            "selected_user"
        );
    });

    test("searching users succeeds", () => {
        testTransition(
            userSearchMachine.withContext(testContext),
            "searching_users",
            {
                type: "done.invoke.usersSearch",
                data: [],
            },
            "idle"
        );
    });

    // not sure that this really tests much
    test("searching users fails", () => {
        testTransition(
            userSearchMachine.withContext(testContext),
            "searching_users",
            {
                type: "error.platform.usersSearch",
                data: new Error("something went wrong"),
            },
            "idle"
        );
    });
});
