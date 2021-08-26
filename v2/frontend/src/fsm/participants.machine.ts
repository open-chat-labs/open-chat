/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign, DoneInvokeEvent } from "xstate";
import { escalate } from "xstate/lib/actions";
import { userSearchMachine } from "./userSearch.machine";
import type { GroupChatSummary } from "../domain/chat/chat";
import type { UserLookup, UserSummary } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

export interface ParticipantsContext {
    serviceContainer: ServiceContainer;
    chatSummary: GroupChatSummary;
    userLookup: UserLookup;
    add: boolean; // used to track whether we go straight into the adding_participant state
    error?: Error;
    user?: UserSummary;
}

export type ParticipantsEvents =
    | { type: "CANCEL_ADD_PARTICIPANT" }
    | { type: "REMOVE_PARTICIPANT"; data: string }
    | { type: "DISMISS_AS_ADMIN"; data: string }
    | { type: "ADD_PARTICIPANT" }
    | { type: "HIDE_PARTICIPANTS" }
    | { type: "done.invoke.removeParticipant" }
    | { type: "error.platform.removeParticipant"; data: Error }
    | { type: "done.invoke.dismissAsAdmin" }
    | { type: "error.platform.dismissAsAdmin"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

const liveConfig: Partial<MachineOptions<ParticipantsContext, ParticipantsEvents>> = {
    guards: {},
    services: {
        removeParticipant: (_ctx, _ev) => {
            // todo - what do we do if this fails given that we have already optimistically removed it?
            // perhaps we have to keep track of the participant that we are trying to delete so that we can
            // re-insert if it fails
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        },
        dismissAsAdmin: (_ctx, _ev) => {
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        },
        addParticipant: (ctx, ev) => {
            if (ev.type === "done.invoke.userSearchMachine") {
                return ctx.serviceContainer.addParticipants(ctx.chatSummary.chatId, [
                    ev.data.userId,
                ]);
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
        ADD_PARTICIPANT: ".adding_participant",
    },
    states: {
        done: { type: "final" },
        init: {
            always: [
                {
                    cond: (ctx, _) => ctx.add,
                    target: "adding_participant",
                },
                {
                    cond: (ctx, _) => !ctx.add,
                    target: "idle",
                },
            ],
        },
        idle: { id: "showing_participants_idle", entry: assign((_ctx, _ev) => ({ add: false })) },
        adding_participant: {
            initial: "choosing_participant",
            states: {
                choosing_participant: {
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
                            target: "saving_participant",
                            actions: assign((ctx, ev: DoneInvokeEvent<UserSummary>) => {
                                if (ctx.chatSummary.kind === "group_chat" && ev.data) {
                                    return {
                                        userLookup: {
                                            ...ctx.userLookup,
                                            [ev.data.userId]: ev.data,
                                        },
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
                saving_participant: {
                    invoke: {
                        id: "addParticipant",
                        src: "addParticipant",
                        onDone: {
                            target: "choosing_participant",
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
            on: {
                CANCEL_ADD_PARTICIPANT: "idle",
                "error.platform.userSearchMachine": "..unexpected_error",
            },
        },
        dismissing_participant: {
            invoke: {
                id: "dismissAsAdmin",
                src: "dismissAsAdmin",
                onDone: {
                    target: "idle",
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
                        chatSummary: {
                            ...ctx.chatSummary,
                            participants: ctx.chatSummary.participants.filter(
                                (p) => p.userId !== ev.data
                            ),
                        },
                    };
                }
                return {};
            }),
            invoke: {
                id: "removeParticipant",
                src: "removeParticipant",
                onDone: {
                    target: "idle",
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
