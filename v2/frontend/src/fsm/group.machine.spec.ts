/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ServiceContainer } from "../services/serviceContainer";
import { testTransition } from "./machine.spec.utils";
import { GroupContext, groupMachine, nullGroup } from "./group.machine";

const testUser = { userId: "123456", username: "test user", secondsSinceLastOnline: 0 };

const testContext: GroupContext = {
    serviceContainer: {} as ServiceContainer,
    error: undefined,
    candidateGroup: nullGroup,
};

describe("group machine transitions", () => {
    // there are two parallel child states within the group machine so we can just treat them
    // as entirely separate for the purposes of testing
    describe("canister creation state", () => {
        test("choose participants", () => {
            const ctx = testTransition(
                groupMachine.withContext(testContext),
                { canister_creation: "idle" },
                { type: "CHOOSE_PARTICIPANTS", data: { ...nullGroup, name: "My fancy group" } },
                { canister_creation: "creating" }
            );
            expect(ctx.candidateGroup.name).toEqual("My fancy group");
        });
        test("choose participants when already created", () => {
            const ctx = testTransition(
                groupMachine.withContext(testContext),
                { canister_creation: "created" },
                { type: "CHOOSE_PARTICIPANTS", data: { ...nullGroup, name: "My fancy group" } },
                { canister_creation: "creating" }
            );
            expect(ctx.candidateGroup.name).toEqual("My fancy group");
        });
    });
    describe("data collection state", () => {
        test("cancel new group", () => {
            testTransition(
                groupMachine.withContext(testContext),
                { data_collection: "group_form" },
                { type: "CANCEL_NEW_GROUP" },
                { data_collection: "done" }
            );
        });
        test("choose participants", () => {
            const ctx = testTransition(
                groupMachine.withContext(testContext),
                { data_collection: "group_form" },
                { type: "CHOOSE_PARTICIPANTS", data: { ...nullGroup, name: "My fancy group" } },
                { data_collection: "choosing_participants" }
            );
            expect(ctx.candidateGroup.name).toEqual("My fancy group");
        });
        test("cancel choosing participants", () => {
            testTransition(
                groupMachine.withContext(testContext),
                { data_collection: "choosing_participants" },
                { type: "CANCEL_CHOOSE_PARTICIPANTS" },
                { data_collection: "group_form" }
            );
        });
        test("remove participant", () => {
            const ctx = testTransition(
                groupMachine.withContext({
                    ...testContext,
                    candidateGroup: {
                        ...testContext.candidateGroup,
                        participants: [
                            {
                                role: "standard",
                                user: testUser,
                            },
                        ],
                    },
                }),
                { data_collection: "choosing_participants" },
                { type: "REMOVE_PARTICIPANT", data: "123456" },
                { data_collection: "choosing_participants" }
            );
            expect(ctx.candidateGroup.participants.length).toBe(0);
        });
        test("complete selection", () => {
            testTransition(
                groupMachine.withContext(testContext),
                { data_collection: "choosing_participants" },
                { type: "COMPLETE" },
                { data_collection: "adding_participants" }
            );
        });
        test("received a user from the user search machine", () => {
            const ctx = testTransition(
                groupMachine.withContext(testContext),
                { data_collection: "choosing_participants" },
                { type: "done.invoke.userSearchMachine", data: testUser },
                { data_collection: "choosing_participants" }
            );
            expect(ctx.candidateGroup.participants.length).toBe(1);
            expect(ctx.candidateGroup.participants[0]).toMatchObject({
                role: "standard",
                user: {
                    userId: "123456",
                    username: "test user",
                },
            });
        });
    });
});
