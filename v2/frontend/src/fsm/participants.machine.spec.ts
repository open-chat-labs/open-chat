/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { GroupChatSummary } from "../domain/chat/chat";
import type { ServiceContainer } from "../services/serviceContainer";
import { ParticipantsContext, participantsMachine } from "./participants.machine";
import { testTransition } from "./machine.spec.utils";

const groupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "This is a test chat",
    description: "And this is what it is all about",
    public: true,
    joined: BigInt(100),
    minVisibleEventIndex: 50,
    minVisibleMessageIndex: 50,
    chatId: "chat_id",
    lastUpdated: BigInt(200),
    readByMe: [],
    latestMessage: undefined,
    latestEventIndex: 0,
    participants: [
        {
            userId: "abc",
            role: "admin",
        },
    ],
};

const testContext: ParticipantsContext = {
    serviceContainer: {} as ServiceContainer,
    chatSummary: groupChat,
    userLookup: {},
    add: false,
    user: {
        userId: "abcdef",
        username: "julian_jelfs",
        secondsSinceLastOnline: 10,
    },
    error: undefined,
};

describe("participant machine transitions", () => {
    test("hide participants", () => {
        testTransition(
            participantsMachine.withContext(testContext),
            "idle",
            { type: "HIDE_PARTICIPANTS" },
            "done"
        );
    });
    test("remove participant", () => {
        testTransition(
            participantsMachine.withContext(testContext),
            "idle",
            { type: "REMOVE_PARTICIPANT", data: "123" },
            "removing_participant"
        );
    });
    test("dismiss as admin", () => {
        testTransition(
            participantsMachine.withContext(testContext),
            "idle",
            { type: "DISMISS_AS_ADMIN", data: "123" },
            "dismissing_participant"
        );
    });
    test("add participant", () => {
        testTransition(
            participantsMachine.withContext(testContext),
            "idle",
            { type: "ADD_PARTICIPANT" },
            "adding_participant"
        );
    });
    test("cancel add participant", () => {
        testTransition(
            participantsMachine.withContext(testContext),
            "adding_participant",
            { type: "CANCEL_ADD_PARTICIPANT" },
            "idle"
        );
    });
});
