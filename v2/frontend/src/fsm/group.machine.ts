// creating a new group is complicated enough to have its own state machine
// The states are going to look something like:
// - group_form
// - editing_avatar
// - choosing_participants
// The other reason to have a dedicated machine is that we need to "remember" the state of the
// candidate group, while the user is selecting participants.
// We also need to track whether canister creation is complete etc. It can get quite fiddly probably.

// this is a job for tomorrow

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign, DoneInvokeEvent } from "xstate";
import { userSearchMachine } from "./userSearch.machine";
import type { UserSummary } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

export interface GroupContext {
    serviceContainer: ServiceContainer;
    error?: Error;
}

export type GroupEvents =
    | { type: "CANCEL_NEW_GROUP" }
    | { type: "CHOOSE_PARTICIPANTS" }
    | { type: "CANCEL_CHOOSE_PARTICIPANTS" }
    | { type: "SKIP_CHOOSE_PARTICIPANTS" }
    | { type: "REMOVE_PARTICIPANT"; data: string }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

const liveConfig: Partial<MachineOptions<GroupContext, GroupEvents>> = {
    guards: {},
    services: {},
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<GroupContext, any, GroupEvents> = {
    id: "group_machine",
    initial: "group_form",
    states: {
        done: { type: "final" },
        group_form: {
            on: {
                CANCEL_NEW_GROUP: "done",
                CHOOSE_PARTICIPANTS: "choosing_participants",
            },
        },
        choosing_participants: {
            on: {
                CANCEL_CHOOSE_PARTICIPANTS: "group_form",
                REMOVE_PARTICIPANT: {
                    // todo
                },
                "error.platform.userSearchMachine": "..unexpected_error",
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
    },
};

export const groupMachine = createMachine<GroupContext, GroupEvents>(schema, liveConfig);
export type GroupMachine = typeof groupMachine;
