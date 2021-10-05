/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign, DoneInvokeEvent } from "xstate";
import { escalate, pure } from "xstate/lib/actions";
import { userSearchMachine } from "./userSearch.machine";
import type {
    GroupChatSummary,
    ChangeAdminResponse,
    RemoveParticipantResponse,
    ParticipantRole,
    UpdateGroupResponse,
} from "../domain/chat/chat";
import type { UserSummary } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";
import { removeParticipant, updateParticipant } from "../domain/chat/chat.utils";
import { toastStore } from "../stores/toast";
import { userStore } from "../stores/user";

export type Mode = "show_participants" | "add_participants" | "group_details";

export type UpdatedAvatar = {
    blobUrl?: string;
    blobData?: Uint8Array;
};

export type UpdatedGroup = {
    name: string;
    desc: string;
    avatar?: UpdatedAvatar;
};
export interface EditGroupContext {
    serviceContainer: ServiceContainer;
    chatSummary: GroupChatSummary;
    updatedGroup: UpdatedGroup;
    history: Mode[]; // this is used to control where we go "back" to
    error?: string;
    usersToAdd: UserSummary[];
    user?: UserSummary;
}

function pop(history: Mode[]): Partial<EditGroupContext> {
    history.pop();
    return {
        history,
    };
}

function push(history: Mode[], next: Mode): Partial<EditGroupContext> {
    history.push(next);
    return {
        history,
    };
}

export type EditGroupEvents =
    | { type: "CANCEL_ADD_PARTICIPANT" }
    | { type: "REMOVE_PARTICIPANT"; data: string }
    | { type: "DISMISS_AS_ADMIN"; data: string }
    | { type: "MAKE_ADMIN"; data: string }
    | { type: "ADD_PARTICIPANT" }
    | { type: "HIDE_PARTICIPANTS" }
    | { type: "SAVE_PARTICIPANTS" }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "SYNC_CHAT_DETAILS"; data: UpdatedGroup }
    | { type: "SAVE_GROUP_DETAILS"; data: UpdatedGroup }
    | { type: "CLOSE_GROUP_DETAILS" }
    | { type: "UNSELECT_PARTICIPANT"; data: UserSummary }
    | { type: "done.invoke.removeParticipant" }
    | { type: "error.platform.removeParticipant"; data: Error }
    | { type: "done.invoke.dismissAsAdmin" }
    | { type: "error.platform.dismissAsAdmin"; data: Error }
    | { type: "done.invoke.saveGroup"; data: UpdateGroupResponse }
    | { type: "error.platform.saveGroup"; data: Error }
    | { type: "done.invoke.makeAdmin" }
    | { type: "error.platform.makeAdmin"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

const liveConfig: Partial<MachineOptions<EditGroupContext, EditGroupEvents>> = {
    guards: {
        showParticipantsNext: (ctx, _) => {
            return ctx.history[ctx.history.length - 1] === "show_participants";
        },
        addParticipantsNext: (ctx, _) => {
            return ctx.history[ctx.history.length - 1] === "add_participants";
        },
        groupDetailsNext: (ctx, _) => {
            return ctx.history[ctx.history.length - 1] === "group_details";
        },
        done: (ctx, _) => {
            return ctx.history.length === 0;
        },
    },
    services: {
        removeParticipant: (ctx, ev) => {
            if (ev.type === "REMOVE_PARTICIPANT") {
                return ctx.serviceContainer.removeParticipant(ctx.chatSummary.chatId, ev.data);
            }
            throw new Error("Unexpected event type provided to EditGroupMachine.dismissAsAdmin");
        },
        dismissAsAdmin: (ctx, ev) => {
            if (ev.type === "DISMISS_AS_ADMIN") {
                return ctx.serviceContainer.dismissAsAdmin(ctx.chatSummary.chatId, ev.data);
            }
            throw new Error("Unexpected event type provided to EditGroupMachine.dismissAsAdmin");
        },
        makeAdmin: (ctx, ev) => {
            if (ev.type === "MAKE_ADMIN") {
                return ctx.serviceContainer.makeAdmin(ctx.chatSummary.chatId, ev.data);
            }
            throw new Error("Unexpected event type provided to EditGroupMachine.makeAdmin");
        },
        addParticipants: (ctx, _ev) => {
            if (ctx.usersToAdd.length > 0) {
                return ctx.serviceContainer.addParticipants(
                    ctx.chatSummary.chatId,
                    ctx.usersToAdd.map((u) => u.userId)
                );
            }
            throw new Error("Unexpected event type provided to EditGroupMachine.addParticipant");
        },
        saveGroup: (ctx, _ev) => {
            return ctx.serviceContainer.updateGroup(
                ctx.chatSummary.chatId,
                ctx.updatedGroup.name,
                ctx.updatedGroup.desc,
                ctx.updatedGroup.avatar?.blobData
            );
        },
    },
};

function groupUpdateErrorMessage(resp: UpdateGroupResponse): string | undefined {
    if (resp === "success") return undefined;
    if (resp === "unchanged") return undefined;
    if (resp === "desc_too_long") return "groupDescTooLong";
    if (resp === "internal_error") return "groupUpdateFailed";
    if (resp === "not_authorised") return "groupUpdateFailed";
    if (resp === "name_too_long") return "groupNameTooLong";
    if (resp === "name_taken") return "groupAlreadyExists";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<EditGroupContext, any, EditGroupEvents> = {
    id: "edit_group_machine",
    initial: "navigate",
    states: {
        done: {
            type: "final",
            data: (ctx, _ev) => ctx.chatSummary,
        },

        navigate: {
            id: "navigate",
            always: [
                {
                    cond: "showParticipantsNext",
                    target: "show_participants",
                },
                {
                    cond: "addParticipantsNext",
                    target: "add_participants",
                },
                {
                    cond: "groupDetailsNext",
                    target: "group_details",
                },
                {
                    cond: "done",
                    target: "done",
                },
            ],
        },

        show_participants: {
            initial: "idle",
            on: {
                HIDE_PARTICIPANTS: {
                    actions: assign(({ history }) => pop(history)),
                    target: "#navigate",
                },
                REMOVE_PARTICIPANT: ".removing_participant",
                DISMISS_AS_ADMIN: ".dismissing_participant",
                MAKE_ADMIN: ".making_admin",
                ADD_PARTICIPANT: {
                    actions: assign(({ history }) => push(history, "add_participants")),
                    target: "add_participants",
                },
            },
            states: {
                idle: {},
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
                        if (
                            ctx.chatSummary.kind === "group_chat" &&
                            ev.type === "DISMISS_AS_ADMIN"
                        ) {
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
                        if (
                            ctx.chatSummary.kind === "group_chat" &&
                            ev.type === "REMOVE_PARTICIPANT"
                        ) {
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
                            actions: assign(
                                (ctx, ev: DoneInvokeEvent<RemoveParticipantResponse>) => {
                                    if (ev.data !== "success") {
                                        // todo - we need to undo the operation here, but we don't have
                                        // the data any more. Tsk.
                                        toastStore.showFailureToast("removeParticipantFailed");
                                    }
                                    return {};
                                }
                            ),
                        },
                        onError: {
                            // todo - need to make sure that this actually works - I'm not sure it does
                            actions: escalate((_, { data }) => data),
                        },
                    },
                },
            },
        },

        add_participants: {
            initial: "choosing_participants",
            on: {
                CANCEL_ADD_PARTICIPANT: {
                    actions: assign(({ history }) => pop(history)),
                    target: "#navigate",
                },
                "error.platform.userSearchMachine": "..unexpected_error",
            },
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
                                    userStore.add(ev.data);
                                    return {
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
                            target: "#navigate",
                            actions: [
                                assign(({ history }) => pop(history)),
                                assign((_ctx, _ev) => ({ usersToAdd: [] })),
                            ],
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
        },

        group_details: {
            initial: "idle",
            on: {
                CLOSE_GROUP_DETAILS: {
                    actions: assign(({ history }) => pop(history)),
                    target: "#navigate",
                },
                SHOW_PARTICIPANTS: {
                    actions: assign(({ history }) => push(history, "show_participants")),
                    target: "show_participants",
                },
                SYNC_CHAT_DETAILS: {
                    actions: assign((_ctx, ev) => ({
                        updatedGroup: ev.data,
                    })),
                },
                SAVE_GROUP_DETAILS: {
                    target: ".saving_group",
                    actions: assign((_ctx, ev) => ({
                        updatedGroup: ev.data,
                    })),
                },
            },
            states: {
                idle: {
                    id: "group_details_idle",
                },
                saving_group: {
                    invoke: {
                        id: "saveGroup",
                        src: "saveGroup",
                        onDone: [
                            {
                                cond: (_, ev: DoneInvokeEvent<UpdateGroupResponse>) =>
                                    ev.data !== "success",
                                target: "#group_details_idle",
                                actions: pure((_ctx, ev) => {
                                    const err = groupUpdateErrorMessage(ev.data);
                                    if (err) toastStore.showFailureToast(err);
                                    return [];
                                }),
                            },
                            {
                                cond: (_, ev: DoneInvokeEvent<UpdateGroupResponse>) =>
                                    ev.data === "success",
                                target: "#navigate",
                                actions: [assign(({ history }) => pop(history))],
                            },
                        ],
                        onError: {
                            target: "#group_details_idle",
                            actions: pure((_ctx, _ev) => {
                                toastStore.showFailureToast("groupUpdateFailed");
                                return undefined;
                            }),
                        },
                    },
                },
            },
        },
    },
};

export const editGroupMachine = createMachine<EditGroupContext, EditGroupEvents>(
    schema,
    liveConfig
);
export type EditGroupMachine = typeof editGroupMachine;
