/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign, DoneInvokeEvent } from "xstate";
import { escalate, log } from "xstate/lib/actions";
import type { UserSummary } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

/** The reason this is split into its own machine is because we will need the exact same behaviour when creating
 * a new direct chat but it will be in a different context
 */

export interface UserSearchContext {
    serviceContainer: ServiceContainer;
    searchTerm: string;
    users: UserSummary[];
    error?: Error;
}

export type UserSearchEvents =
    | { type: "ON_INPUT"; data: string }
    | { type: "CLEAR" }
    | { type: "SELECT_USER"; data: UserSummary }
    | { type: "done.invoke.userSearch"; data: UserSummary[] }
    | { type: "error.platform.userSearch"; data: Error };

const liveConfig: Partial<MachineOptions<UserSearchContext, UserSearchEvents>> = {
    guards: {},
    services: {
        usersSearch: async (ctx, _) => {
            return ctx.serviceContainer.searchUsers(ctx.searchTerm);
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<UserSearchContext, any, UserSearchEvents> = {
    id: "user_search_machine",
    initial: "idle",
    on: {
        ON_INPUT: {
            target: "searching_users",
            cond: (_, ev) => ev.data.length > 0,
            actions: assign((_ctx, ev) => ({
                searchTerm: ev.data,
            })),
        },
        CLEAR: {
            actions: assign((_ctx, _ev) => ({
                searchTerm: "",
                users: [],
            })),
        },
        SELECT_USER: "selected_user",
    },
    states: {
        idle: {
            entry: log("entering user search idle state"),
        },
        searching_users: {
            invoke: {
                id: "usersSearch",
                src: "usersSearch",
                onDone: {
                    target: "idle",
                    actions: assign((_, ev: DoneInvokeEvent<UserSummary[]>) => {
                        return {
                            users: ev.data,
                            error: undefined,
                        };
                    }),
                },
                onError: {
                    target: "idle",
                    actions: escalate((_, { data }) => data),
                },
            },
        },
        selected_user: {
            type: "final",
            data: (_, ev) => (ev.type === "SELECT_USER" ? ev.data : undefined),
        },
    },
};

export const userSearchMachine = createMachine<UserSearchContext, UserSearchEvents>(
    schema,
    liveConfig
);
export type UserSearchMachine = typeof userSearchMachine;
