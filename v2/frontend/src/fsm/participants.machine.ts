/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign, DoneInvokeEvent } from "xstate";
import { escalate } from "xstate/lib/actions";
import { userSearchMachine } from "./userSearch.machine";
import type {
    GroupChatSummary,
    ChangeAdminResponse,
    RemoveParticipantResponse,
    ParticipantRole,
} from "../domain/chat/chat";
import type { UserLookup, UserSummary } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";
import { removeParticipant, updateParticipant } from "../domain/chat/chat.utils";
import { toastStore } from "../stores/toast";

export interface ParticipantsContext {
    serviceContainer: ServiceContainer;
    chatSummary: GroupChatSummary;
    userLookup: UserLookup;
    add: boolean; // used to track whether we go straight into the adding_participant state
    error?: Error;
    usersToAdd: UserSummary[];
    user?: UserSummary;
}

export type ParticipantsEvents =
    | { type: "CANCEL_ADD_PARTICIPANT" }
    | { type: "REMOVE_PARTICIPANT"; data: string }
    | { type: "DISMISS_AS_ADMIN"; data: string }
    | { type: "MAKE_ADMIN"; data: string }
    | { type: "ADD_PARTICIPANT" }
    | { type: "HIDE_PARTICIPANTS" }
    | { type: "SAVE_PARTICIPANTS" }
    | { type: "UNSELECT_PARTICIPANT"; data: UserSummary }
    | { type: "done.invoke.removeParticipant" }
    | { type: "error.platform.removeParticipant"; data: Error }
    | { type: "done.invoke.dismissAsAdmin" }
    | { type: "error.platform.dismissAsAdmin"; data: Error }
    | { type: "done.invoke.makeAdmin" }
    | { type: "error.platform.makeAdmin"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

const liveConfig: Partial<MachineOptions<ParticipantsContext, ParticipantsEvents>> = {
    guards: {},
    services: {
        removeParticipant: (ctx, ev) => {
            if (ev.type === "REMOVE_PARTICIPANT") {
                return ctx.serviceContainer.removeParticipant(ctx.chatSummary.chatId, ev.data);
            }
            throw new Error("Unexpected event type provided to ParticipantsMachine.dismissAsAdmin");
        },
        dismissAsAdmin: (ctx, ev) => {
            if (ev.type === "DISMISS_AS_ADMIN") {
                return ctx.serviceContainer.dismissAsAdmin(ctx.chatSummary.chatId, ev.data);
            }
            throw new Error("Unexpected event type provided to ParticipantsMachine.dismissAsAdmin");
        },
        makeAdmin: (ctx, ev) => {
            if (ev.type === "MAKE_ADMIN") {
                return ctx.serviceContainer.makeAdmin(ctx.chatSummary.chatId, ev.data);
            }
            throw new Error("Unexpected event type provided to ParticipantsMachine.makeAdmin");
        },
        addParticipants: (ctx, _ev) => {
            if (ctx.usersToAdd.length > 0) {
                return ctx.serviceContainer.addParticipants(
                    ctx.chatSummary.chatId,
                    ctx.usersToAdd.map((u) => u.userId)
                );
            }
            throw new Error("Unexpected event type provided to ParticipantsMachine.addParticipant");
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<ParticipantsContext, any, ParticipantsEvents> = {
    id: "participants_machine",
    initial: "init",
    on: {
        HIDE_PARTICIPANTS: ".done", // todo make sure this goes to the parent.idle state correctly
        REMOVE_PARTICIPANT: ".removing_participant",
        DISMISS_AS_ADMIN: ".dismissing_participant",
        MAKE_ADMIN: ".making_admin",
        ADD_PARTICIPANT: ".adding_participants",
    },
    states: {
        done: { type: "final" },

        init: {
            always: [
                {
                    cond: (ctx, _) => ctx.add,
                    target: "adding_participants",
                },
                {
                    cond: (ctx, _) => !ctx.add,
                    target: "idle",
                },
            ],
        },
        idle: { id: "showing_participants_idle", entry: assign((_ctx, _ev) => ({ add: false })) },
        adding_participants: {
            initial: "choosing_participants",
            states: {
                choosing_participants: {
                    on: {
                        SAVE_PARTICIPANTS: "saving_participants",
                        UNSELECT_PARTICIPANT: {
                            actions: assign((ctx, ev) => ({
                                usersToAdd: ctx.usersToAdd.filter(
                                    (u) => u.userId !== ev.data.userId
                                ),
                            })),
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
                                if (ctx.chatSummary.kind === "group_chat" && ev.data) {
                                    return {
                                        userLookup: {
                                            ...ctx.userLookup,
                                            [ev.data.userId]: ev.data,
                                        },
                                        usersToAdd: [ev.data, ...ctx.usersToAdd],
                                    };
                                }
                                return {};
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
                saving_participants: {
                    invoke: {
                        id: "addParticipants",
                        src: "addParticipants",
                        onDone: {
                            // todo - here we need to check for any failure and if it fails,
                            // remove the participant we added and toast (and log) the error
                            target: "#showing_participants_idle",
                            actions: assign((_ctx, _ev) => ({ usersToAdd: [] })),
                        },
                        onError: {
                            internal: true,
                            target: "..unexpected_error",
                            actions: [
                                assign((ctx, ev) => ({
                                    error: ev.data,
                                    chatSummary: {
                                        ...ctx.chatSummary,
                                        participants: ctx.chatSummary.participants.filter((p) => {
                                            !ctx.usersToAdd.map((u) => u.userId).includes(p.userId);
                                        }),
                                    },
                                })),
                            ],
                        },
                    },
                    entry: assign((ctx, _ev) => {
                        return {
                            chatSummary: {
                                ...ctx.chatSummary,
                                participants: [
                                    ...ctx.usersToAdd.map((u) => ({
                                        userId: u.userId,
                                        role: "standard" as ParticipantRole,
                                    })),
                                    ...ctx.chatSummary.participants,
                                ],
                            },
                        };
                    }),
                },
            },
            on: {
                CANCEL_ADD_PARTICIPANT: "idle",
                "error.platform.userSearchMachine": "..unexpected_error",
            },
        },
        making_admin: {
            // optimistically set the user standard in memory
            // if the operation fails, undo it
            entry: assign((ctx, ev) => {
                if (ctx.chatSummary.kind === "group_chat" && ev.type === "MAKE_ADMIN") {
                    return {
                        chatSummary: updateParticipant(ctx.chatSummary, ev.data, (p) => ({
                            ...p,
                            role: "admin",
                        })),
                    };
                }
                return {};
            }),
            invoke: {
                id: "makeAdmin",
                src: "makeAdmin",
                onDone: {
                    target: "idle",
                    actions: assign((ctx, ev: DoneInvokeEvent<ChangeAdminResponse>) => {
                        if (ev.data !== "success") {
                            // todo - we need to undo the operation here, but we don't have
                            // the data any more. Tsk.
                            toastStore.showFailureToast("makeAdminFailed");
                        }
                        return {};
                    }),
                },
                onError: {
                    target: "..unexpected_error",
                    actions: assign({
                        error: (_, { data }) => data,
                    }),
                },
            },
        },
        dismissing_participant: {
            // optimistically set the user standard in memory
            // if the operation fails, undo it
            entry: assign((ctx, ev) => {
                if (ctx.chatSummary.kind === "group_chat" && ev.type === "DISMISS_AS_ADMIN") {
                    return {
                        chatSummary: updateParticipant(ctx.chatSummary, ev.data, (p) => ({
                            ...p,
                            role: "standard",
                        })),
                    };
                }
                return {};
            }),
            invoke: {
                id: "dismissAsAdmin",
                src: "dismissAsAdmin",
                onDone: {
                    target: "idle",
                    actions: assign((ctx, ev: DoneInvokeEvent<ChangeAdminResponse>) => {
                        if (ev.data !== "success") {
                            // todo - we need to undo the operation here, but we don't have
                            // the data any more. Tsk.
                            toastStore.showFailureToast("dismissAsAdminFailed");
                        }
                        return {};
                    }),
                },
                onError: {
                    target: "..unexpected_error",
                    actions: assign({
                        error: (_, { data }) => data,
                    }),
                },
            },
        },
        removing_participant: {
            entry: assign((ctx, ev) => {
                if (ctx.chatSummary.kind === "group_chat" && ev.type === "REMOVE_PARTICIPANT") {
                    return {
                        chatSummary: removeParticipant(ctx.chatSummary, ev.data),
                    };
                }
                return {};
            }),
            invoke: {
                id: "removeParticipant",
                src: "removeParticipant",
                onDone: {
                    target: "idle",
                    actions: assign((ctx, ev: DoneInvokeEvent<RemoveParticipantResponse>) => {
                        if (ev.data !== "success") {
                            // todo - we need to undo the operation here, but we don't have
                            // the data any more. Tsk.
                            toastStore.showFailureToast("removeParticipantFailed");
                        }
                        return {};
                    }),
                },
                onError: {
                    // todo - need to make sure that this actually works - I'm not sure it does
                    actions: escalate((_, { data }) => data),
                },
            },
        },
    },
};

export const participantsMachine = createMachine<ParticipantsContext, ParticipantsEvents>(
    schema,
    liveConfig
);
export type ParticipantsMachine = typeof participantsMachine;
