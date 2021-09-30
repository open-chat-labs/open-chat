/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HttpAgentRequest, Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import type { MachineOptions } from "xstate";
import type { IdentityContext, IdentityEvents } from "./identity.machine";
import { identityMachine } from "./identity.machine";
import type { CurrentUserResponse } from "../domain/user/user";
import { testSequence, testTransition } from "./machine.spec.utils";
import { ServiceContainer } from "../services/serviceContainer";
import { GroupIndexClient } from "../services/groupIndex/groupIndex.client";
import { UserIndexClient } from "../services/userIndex/userIndex.client";

type Config = Partial<MachineOptions<IdentityContext, IdentityEvents>>;

const fakeUser: CurrentUserResponse = {
    kind: "created_user",
    userId: "abcdefg",
    username: "julian_jelfs",
    accountBalance: BigInt(10000),
    canisterUpgradeStatus: "not_required",
};

const fakeIdentity: Identity = {
    getPrincipal: () => ({ toText: () => "" } as Principal),
    transformRequest: (_req: HttpAgentRequest) => Promise.resolve({}),
};

GroupIndexClient.create = jest.fn();
UserIndexClient.create = jest.fn();
const mockServiceContainer = new ServiceContainer(fakeIdentity);

// create a test version of all of our side effects
function testConfig(): Config {
    return {
        guards: {
            isAnonymous: (_ctx, _) => false,
            notAnonymous: (_ctx, _) => true,
            userIsRegistered: (_ctx, _) => true,
            userIsNotRegistered: (_ctx, _) => false,
            registrationSucceeded: (_ctx, _) => true,
            registrationFailed: (_ctx, _) => false,
            isAuthError: (_ctx, _) => false,
            userRequiresUpgrade: (_, _ev) => false,
            userUpgradeInProgress: (_, _ev) => false,
        },

        // we definitely need the services to be separate so that we can easily mock them
        services: {
            getUser: jest.fn().mockResolvedValue(fakeUser),
            login: jest.fn().mockResolvedValue(fakeIdentity),
            logout: jest.fn().mockResolvedValue(undefined),
            getIdentity: jest.fn().mockResolvedValue(fakeIdentity),
            startSession: jest.fn().mockResolvedValue(undefined),
            upgradeUser: jest.fn().mockResolvedValue(undefined),
            homeMachine: jest.fn().mockResolvedValue(undefined),
            registerMachine: jest.fn().mockResolvedValue(undefined),
        },
    };
}

function updateConfig(partialGuards: any = {}, partialServices: any = {}) {
    const defaultConfig = testConfig();
    return {
        ...defaultConfig,
        guards: {
            ...defaultConfig.guards,
            ...partialGuards,
        },
        services: {
            ...defaultConfig.services,
            ...partialServices,
        },
    };
}

describe("identity machine end to end", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    test("successfully loaded user", (done) => {
        mockServiceContainer.createUserClient = jest.fn();
        const config = testConfig();
        testSequence(
            ["requesting_identity", "loading_user", "logged_in"],
            done,
            identityMachine
                .withConfig(config)
                .withContext({ serviceContainer: mockServiceContainer }),
            (state) => {
                expect(config.services!.getIdentity).toHaveBeenCalled();
                expect(state.context.identity).toEqual(fakeIdentity);
            }
        );
    });

    test("successfully loaded identity, user not registered", (done) => {
        const config = updateConfig({
            userIsRegistered: () => false,
            userIsNotRegistered: () => true,
        });
        testSequence(
            ["requesting_identity", "loading_user", "register_user"],
            done,
            identityMachine.withConfig(config),
            (state) => {
                expect(config.services!.getIdentity).toHaveBeenCalled();
                expect(state.context.identity).toEqual(fakeIdentity);
            }
        );
    });

    test("failed to load identity", (done) => {
        const config = updateConfig(
            {},
            {
                getIdentity: jest.fn().mockRejectedValue("failed to load identity"),
            }
        );
        testSequence(
            ["requesting_identity", "unexpected_error"],
            done,
            identityMachine.withConfig(config),
            (state) => {
                expect(config.services!.getIdentity).toHaveBeenCalled();
                expect(state.context.identity).toBe(undefined);
                expect(state.context.error).toBe("failed to load identity");
            }
        );
    });

    test("received anonymous identity", (done) => {
        const config = updateConfig({
            isAnonymous: () => true,
        });
        testSequence(
            ["requesting_identity", "login"],
            done,
            identityMachine.withConfig(config),
            (state) => {
                expect(config.services!.getIdentity).toHaveBeenCalled();
                expect(state.context.identity).toBe(fakeIdentity);
                expect(state.context.error).toBe(undefined);
            }
        );
    });
});

describe("identity machine transitions", () => {
    test("when requesting identity succeeds", () => {
        testTransition(
            identityMachine,
            "requesting_identity",
            "done.invoke.getIdentity",
            "loading_user",
            testConfig()
        );
    });

    test("when requesting identity returns anonymous identity", () => {
        testTransition(
            identityMachine,
            "requesting_identity",
            "done.invoke.getIdentity",
            "login",
            updateConfig({
                isAnonymous: () => true,
            })
        );
    });

    test("firing login intiates logging in", () => {
        testTransition(identityMachine, "login", "LOGIN", "logging_in", testConfig());
    });

    test("logging in successfully goes to loading_user", () => {
        testTransition(
            identityMachine,
            "logging_in",
            "done.invoke.login",
            "loading_user",
            testConfig()
        );
    });

    test("logging in with anonymous user returns to login", () => {
        testTransition(
            identityMachine,
            "logging_in",
            "done.invoke.login",
            "login",
            updateConfig({
                isAnonymous: () => true,
            })
        );
    });

    test("when login fails", () => {
        testTransition(
            identityMachine,
            "logging_in",
            "error.platform.login",
            "unexpected_error",
            testConfig()
        );
    });

    test("when requesting identity fails", () => {
        testTransition(
            identityMachine,
            "requesting_identity",
            "error.platform.getIdentity",
            "unexpected_error",
            testConfig()
        );
    });

    test("can retry from the unexpected_error state", () => {
        testTransition(
            identityMachine,
            "unexpected_error",
            "REQUEST_IDENTITY",
            "requesting_identity",
            testConfig()
        );
    });

    test("can acknowledge session expiry", () => {
        testTransition(
            identityMachine,
            "expired",
            "ACKNOWLEDGE_EXPIRY",
            "logging_in",
            testConfig()
        );
    });

    test("can initiate logout", () => {
        testTransition(identityMachine, "logged_in", "LOGOUT", "logging_out", testConfig());
    });

    test("when logout succeeds", () => {
        testTransition(identityMachine, "logging_out", "done.invoke.logout", "login", testConfig());
    });

    test("when logout fails", () => {
        testTransition(
            identityMachine,
            "logging_out",
            "error.platform.logout",
            "unexpected_error",
            testConfig()
        );
    });

    test("when logging out from register user", () => {
        testTransition(identityMachine, "register_user", "LOGOUT", "logging_out", testConfig());
    });

    test("auth errors send us to expired state", () => {
        testTransition(
            identityMachine,
            "register_user",
            "error.platform.registerMachine",
            "expired",
            updateConfig({
                isAuthError: () => true,
            })
        );
    });

    test("when register user succeeds", () => {
        mockServiceContainer.createUserClient = jest.fn();
        testTransition(
            identityMachine.withContext({ serviceContainer: mockServiceContainer }),
            "register_user",
            { type: "done.invoke.registerMachine", data: fakeUser },
            "logged_in",
            testConfig()
        );
    });

    test("when user requires upgrade", () => {
        testTransition(
            identityMachine,
            "loading_user",
            {
                type: "done.invoke.getUser",
                data: {
                    kind: "created_user",
                    userId: "abcdefg",
                    username: "julian_jelfs",
                    accountBalance: BigInt(10000),
                    canisterUpgradeStatus: "required",
                },
            },
            "upgrade_user",
            updateConfig({
                userRequiresUpgrade: () => true,
            })
        );
    });

    test("when user is upgrading", () => {
        testTransition(
            identityMachine,
            "loading_user",
            {
                type: "done.invoke.getUser",
                data: {
                    kind: "created_user",
                    userId: "abcdefg",
                    username: "julian_jelfs",
                    accountBalance: BigInt(10000),
                    canisterUpgradeStatus: "in_progress",
                },
            },
            "upgrading_user",
            updateConfig({
                userUpgradeInProgress: () => true,
            })
        );
    });
});
