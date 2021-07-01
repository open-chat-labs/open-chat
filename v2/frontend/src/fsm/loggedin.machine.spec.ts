/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { loggedInMachine } from "./loggedin.machine";
import { testTransition } from "./machine.spec.utils";

describe("logged in machine transitions", () => {
    test("getChats fails", () => {
        testTransition(
            loggedInMachine,
            "loading_chats",
            "error.platform.getChats",
            "unexpected_error"
        );
    });
});
