/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { GroupChatSummary } from "../domain/chat/chat";
import type { ServiceContainer } from "../services/serviceContainer";
import { EditGroupContext, editGroupMachine } from "./editgroup.machine";
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

const testContext: EditGroupContext = {
    serviceContainer: {} as ServiceContainer,
    chatSummary: groupChat,
    updatedGroup: { name: groupChat.name, desc: groupChat.description },
    history: ["group_details"],
    user: {
        userId: "abcdef",
        username: "julian_jelfs",
        secondsSinceLastOnline: 10,
    },
    error: undefined,
    usersToAdd: [],
};

describe("edit group machine transitions", () => {
    describe("group details transitions", () => {
        test("close group details", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { group_details: "idle" },
                { type: "CLOSE_GROUP_DETAILS" },
                "done"
            );
        });
        test("show participants", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { group_details: "idle" },
                { type: "SHOW_PARTICIPANTS" },
                "show_participants"
            );
        });
        test("sync chat details", () => {
            const ctx = testTransition(
                editGroupMachine.withContext(testContext),
                { group_details: "idle" },
                { type: "SYNC_CHAT_DETAILS", data: { name: "updated name", desc: "updated desc" } },
                { group_details: "idle" }
            );
            expect(ctx.updatedGroup.name).toEqual("updated name");
            expect(ctx.updatedGroup.desc).toEqual("updated desc");
        });
        test("save chat details", () => {
            const ctx = testTransition(
                editGroupMachine.withContext(testContext),
                { group_details: "idle" },
                {
                    type: "SAVE_GROUP_DETAILS",
                    data: { name: "updated name", desc: "updated desc" },
                },
                { group_details: "saving_group" }
            );
            expect(ctx.updatedGroup.name).toEqual("updated name");
            expect(ctx.updatedGroup.desc).toEqual("updated desc");
        });
        test("save chat details success", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { group_details: "saving_group" },
                "done.invoke.saveGroup",
                { group_details: "idle" }
            );
        });
        test("save chat details failure", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { group_details: "saving_group" },
                { type: "error.platform.saveGroup", data: new Error("fail") },
                { group_details: "idle" }
            );
        });
    });

    describe("add participants transitions", () => {
        test("cancel add participant", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { add_participants: "choosing_participants" },
                { type: "CANCEL_ADD_PARTICIPANT" },
                "done"
            );
        });
    });

    describe("show participants transitions", () => {
        test("hide participants", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { show_participants: "idle" },
                { type: "HIDE_PARTICIPANTS" },
                "done"
            );
        });
        test("remove participant", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { show_participants: "idle" },
                { type: "REMOVE_PARTICIPANT", data: "123" },
                { show_participants: "removing_participant" }
            );
        });
        test("dismiss as admin", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { show_participants: "idle" },
                { type: "DISMISS_AS_ADMIN", data: "123" },
                { show_participants: "dismissing_participant" }
            );
        });
        test("add participant", () => {
            testTransition(
                editGroupMachine.withContext(testContext),
                { show_participants: "idle" },
                { type: "ADD_PARTICIPANT" },
                { add_participants: "choosing_participants" }
            );
        });
    });
});
