/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign, DoneInvokeEvent } from "xstate";
import { userSearchMachine } from "./userSearch.machine";
import type { UserSummary } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";
import { toastStore } from "../stores/toast";
import type {
    CandidateGroupChat,
    CreateGroupResponse,
    GroupChatSummary,
} from "../domain/chat/chat";
import { pure } from "xstate/lib/actions";
import { push } from "svelte-spa-router";
import type { ApiAddParticipantsResponse } from "../services/group/candid/idl";

export interface GroupContext {
    user: UserSummary;
    serviceContainer: ServiceContainer;
    candidateGroup: CandidateGroupChat;
    createdGroup?: GroupChatSummary;
    error?: Error;
}

export const nullGroup = {
    name: "",
    description: "",
    historyVisible: false,
    isPublic: false,
    participants: [],
};

export type GroupEvents =
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

const liveConfig: Partial<MachineOptions<GroupContext, GroupEvents>> = {
    services: {
        createGroup: (ctx, _) => {
            return ctx.serviceContainer.createGroupChat(ctx.candidateGroup);
        },
        addParticipants: (ctx, _) => {
            return ctx.serviceContainer.addParticipants(
                ctx.createdGroup!.chatId,
                ctx.candidateGroup.participants.map((p) => p.user.userId)
            );
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<GroupContext, any, GroupEvents> = {
    id: "group_machine",
    type: "parallel",
    states: {
        canister_creation: {
            initial: "idle",
            states: {
                unexpected_error: {},
                creating: {
                    invoke: {
                        id: "createGroup",
                        src: "createGroup",
                        onDone: [
                            {
                                cond: (_, ev: DoneInvokeEvent<CreateGroupResponse>) =>
                                    ev.data.kind !== "success",
                                target: "unexpected_error",
                                actions: assign((_ctx, _ev) => {
                                    toastStore.showFailureToast("groupCreationFailed");
                                    return {
                                        error: new Error("groupCreationFailed"),
                                    };
                                }),
                            },
                            {
                                cond: (_, ev: DoneInvokeEvent<CreateGroupResponse>) =>
                                    ev.data.kind === "success",
                                target: "created",
                                actions: assign((ctx, ev: DoneInvokeEvent<CreateGroupResponse>) => {
                                    if (ev.data.kind === "success") {
                                        const now = BigInt(+new Date());
                                        const chat: GroupChatSummary = {
                                            kind: "group_chat",
                                            name: ctx.candidateGroup.name,
                                            description: ctx.candidateGroup.description,
                                            participants: [],
                                            public: ctx.candidateGroup.isPublic,
                                            joined: now,
                                            minVisibleEventIndex: 0,
                                            minVisibleMessageIndex: 0,
                                            chatId: ev.data.canisterId,
                                            readByMe: [],
                                            latestMessage: undefined,
                                            latestEventIndex: 0,
                                            lastUpdated: now,
                                        };
                                        return {
                                            createdGroup: chat,
                                            error: undefined,
                                        };
                                    }
                                    return {};
                                }),
                            },
                        ],
                        onError: {
                            target: "unexpected_error",
                            actions: assign({
                                error: (_, { data }) => data,
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
                        "error.platform.userSearchMachine": "..unexpected_error",
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
                            internal: true,
                            target: "..unexpected_error",
                            actions: [
                                assign({
                                    error: (_, { data }) => data,
                                }),
                            ],
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
                                if (ctx.createdGroup) {
                                    push(`/${ctx.createdGroup.chatId}`); // trigger the selection of the chat
                                }
                                return undefined;
                            }),
                        },
                        onError: {
                            internal: true,
                            target: "..unexpected_error",
                            actions: [
                                assign({
                                    error: (_, { data }) => data,
                                }),
                            ],
                        },
                    },
                },
            },
        },
    },
};

export const groupMachine = createMachine<GroupContext, GroupEvents>(schema, liveConfig);
export type GroupMachine = typeof groupMachine;
