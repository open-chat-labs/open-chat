/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign, DoneInvokeEvent } from "xstate";
import { userSearchMachine } from "./userSearch.machine";
import type { UserSummary } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";
import { toastStore } from "../stores/toast";
import type { CandidateGroupChat, CreateGroupResponse } from "../domain/chat/chat";
import { pure } from "xstate/lib/actions";
import { push } from "svelte-spa-router";
import type { ApiAddParticipantsResponse } from "../services/group/candid/idl";

export interface AddGroupContext {
    user: UserSummary;
    serviceContainer: ServiceContainer;
    candidateGroup: CandidateGroupChat;
    createdGroupId?: string;
}

export const nullGroup = {
    name: "",
    description: "",
    historyVisible: false,
    isPublic: false,
    participants: [],
};

export type AddGroupEvents =
    | { type: "CANCEL_NEW_GROUP" }
    | { type: "COMPLETE" }
    | { type: "CHOOSE_PARTICIPANTS"; data: CandidateGroupChat }
    | { type: "CANCEL_CHOOSE_PARTICIPANTS" }
    | { type: "SKIP_CHOOSE_PARTICIPANTS" }
    | { type: "REMOVE_PARTICIPANT"; data: string }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error }
    | { type: "done.invoke.createGroup"; data: CreateGroupResponse }
    | { type: "error.platform.createGroup"; data: Error }
    | { type: "done.invoke.addParticipants"; data: ApiAddParticipantsResponse }
    | { type: "error.platform.addParticipants"; data: Error };

const liveConfig: Partial<MachineOptions<AddGroupContext, AddGroupEvents>> = {
    services: {
        createGroup: (ctx, _) => {
            return ctx.serviceContainer.createGroupChat(ctx.candidateGroup);
        },
        addParticipants: (ctx, _) => {
            return ctx.serviceContainer.addParticipants(
                ctx.createdGroupId!,
                ctx.candidateGroup.participants.map((p) => p.user.userId)
            );
        },
    },
};

function groupCreationErrorMessage(resp: CreateGroupResponse): string | undefined {
    if (resp.kind === "success") return undefined;
    if (resp.kind === "description_too_long") return "groupDescTooLong";
    if (resp.kind === "internal_error") return "groupCreationFailed";
    if (resp.kind === "invalid_name") return "groupNameInvalid";
    if (resp.kind === "name_too_long") return "groupNameTooLong";
    if (resp.kind === "group_name_taken") return "groupAlreadyExists";
    if (resp.kind === "throttled") return "groupCreationFailed";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<AddGroupContext, any, AddGroupEvents> = {
    id: "add_group_machine",
    type: "parallel",
    states: {
        canister_creation: {
            initial: "idle",
            states: {
                creating: {
                    invoke: {
                        id: "createGroup",
                        src: "createGroup",
                        onDone: [
                            {
                                cond: (_, ev: DoneInvokeEvent<CreateGroupResponse>) =>
                                    ev.data.kind !== "success",
                                target: ["#group_form", "idle"],
                                actions: pure((_ctx, ev) => {
                                    const err = groupCreationErrorMessage(ev.data);
                                    if (err) toastStore.showFailureToast(err);
                                    return [];
                                }),
                            },
                            {
                                cond: (_, ev: DoneInvokeEvent<CreateGroupResponse>) =>
                                    ev.data.kind === "success",
                                target: "created",
                                actions: assign(
                                    (_ctx, ev: DoneInvokeEvent<CreateGroupResponse>) => {
                                        if (ev.data.kind === "success") {
                                            return {
                                                createdGroupId: ev.data.canisterId,
                                            };
                                        }
                                        return {};
                                    }
                                ),
                            },
                        ],
                        onError: {
                            target: ["#group_form", "idle"],
                            actions: pure((_ctx, _ev) => {
                                toastStore.showFailureToast("groupCreationFailed");
                                return [];
                            }),
                        },
                    },
                },
                created: {
                    type: "final",
                    // todo - we *probably* want to do something slightly different if the user
                    // updates a group after we have already created it
                    on: {
                        CHOOSE_PARTICIPANTS: {
                            target: "creating",
                            actions: assign((_, ev) => ({
                                candidateGroup: ev.data,
                            })),
                        },
                    },
                },
                idle: {
                    on: {
                        CANCEL_NEW_GROUP: "created", //this is just so that the whole machine goes to the done state
                        CHOOSE_PARTICIPANTS: {
                            target: "creating",
                            actions: assign((_, ev) => ({
                                candidateGroup: ev.data,
                            })),
                        },
                    },
                },
            },
        },
        data_collection: {
            initial: "group_form",
            states: {
                done: { type: "final" },
                group_form: {
                    id: "group_form",
                    on: {
                        CANCEL_NEW_GROUP: "done",
                        CHOOSE_PARTICIPANTS: {
                            target: "choosing_participants",
                            actions: assign((_, ev) => ({
                                candidateGroup: ev.data,
                            })),
                        },
                    },
                },
                choosing_participants: {
                    on: {
                        CANCEL_CHOOSE_PARTICIPANTS: "group_form",
                        REMOVE_PARTICIPANT: {
                            actions: assign((ctx, ev) => ({
                                candidateGroup: {
                                    ...ctx.candidateGroup,
                                    participants: ctx.candidateGroup.participants.filter(
                                        (p) => p.user.userId !== ev.data
                                    ),
                                },
                            })),
                        },
                        COMPLETE: {
                            target: "adding_participants",
                        },
                    },
                    invoke: {
                        id: "userSearchMachine",
                        src: userSearchMachine,
                        data: (ctx, _) => {
                            return {
                                serviceContainer: ctx.serviceContainer,
                                searchTerm: "",
                                users: [],
                                error: undefined,
                            };
                        },
                        onDone: {
                            target: "choosing_participants",
                            actions: assign((ctx, ev: DoneInvokeEvent<UserSummary>) => {
                                return {
                                    candidateGroup: {
                                        ...ctx.candidateGroup,
                                        participants: [
                                            ...ctx.candidateGroup.participants,
                                            {
                                                role: "standard",
                                                user: ev.data,
                                            },
                                        ],
                                    },
                                };
                            }),
                        },
                        onError: {
                            actions: pure((_ctx, _ev) => {
                                toastStore.showFailureToast("userSearchFailed");
                                return [];
                            }),
                        },
                    },
                },
                adding_participants: {
                    invoke: {
                        id: "addParticipants",
                        src: "addParticipants",
                        onDone: {
                            target: "done",
                            actions: pure((ctx, _) => {
                                // todo - there is a bunch of error handling missing here
                                // we are currently assuming success
                                if (ctx.createdGroupId) {
                                    push(`/${ctx.createdGroupId}`); // trigger the selection of the chat
                                }
                                return undefined;
                            }),
                        },
                        onError: {
                            actions: pure((_ctx, _ev) => {
                                toastStore.showFailureToast("addParticipantsFailed");
                                return [];
                            }),
                        },
                    },
                },
            },
        },
    },
};

export const addGroupMachine = createMachine<AddGroupContext, AddGroupEvents>(schema, liveConfig);
export type AddGroupMachine = typeof addGroupMachine;
