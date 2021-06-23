import type { HttpAgentRequest, Identity } from '@dfinity/agent';
import type { Principal } from '@dfinity/principal';
import { interpret, MachineOptions } from 'xstate';
import type { Event, StateValue } from 'xstate';
import type { IdentityContext, IdentityEvents } from './identity.machine';
import { identityMachine } from './identity.machine';

type Config = Partial<MachineOptions<IdentityContext, IdentityEvents>>;

const fakeIdentity: Identity = {
    getPrincipal: () => ({} as Principal),
    transformRequest: (req: HttpAgentRequest) => (Promise.resolve({}))
}

// create a test version of all of our side effects
const testConfig: Config = {
    guards: {
        isAnonymous: (_ctx, _) => false,
        notAnonymous: (_ctx, _) => true,
    },

    // we definitely need the services to be separate so that we can easily mock them
    services: {
        login: jest.fn().mockResolvedValue(fakeIdentity),
        logout: jest.fn().mockResolvedValue(undefined),
        getIdentity: jest.fn().mockResolvedValue(fakeIdentity),
        startSession: jest.fn().mockResolvedValue(undefined),
    }
}

function updateConfig(partialGuards: typeof testConfig.guards = {}, partialServices: typeof testConfig.services = {}) {
    return {
        ...testConfig,
        guards: {
            ...testConfig.guards,
            ...partialGuards
        },
        services: {
            ...testConfig.services,
            ...partialServices
        }
    }
}


function getService(config: Config = {}) {
    return interpret(identityMachine.withConfig(config));
}

describe('identity machine', () => {
    function testTransition(from: StateValue, ev: Event<IdentityEvents>, to: StateValue, config: Config = testConfig) {
        const machine = identityMachine.withConfig(config);
        const nextState = machine.transition(from, ev);
        expect(nextState.value).toBe(to);
    }

    test('when requesting identity succeeds', () => {
        testTransition('requesting_identity', 'done.invoke.getIdentity', 'loading_user')
    })

    test('when requesting identity returns anonymous identity', () => {
        testTransition('requesting_identity', 'done.invoke.getIdentity', 'login', updateConfig({
            isAnonymous: () => true
        }))
    })

    test('firing login intiates logging in', () => {
        testTransition('login', 'LOGIN', 'logging_in');
    })

    test('logging in successfully goes to loading_user', () => {
        testTransition('logging_in', 'done.invoke.login', 'loading_user')
    })

    test('logging in with anonymous user returns to login', () => {
        testTransition('logging_in', 'done.invoke.login', 'login', updateConfig({
            isAnonymous: () => true
        }))
    })

    test('when login fails', () => {
        testTransition('logging_in', 'error.platform.login', 'failure')
    })

    test('when requesting identity fails', () => {
        testTransition('requesting_identity', 'error.platform.getIdentity', 'failure')
    })

    test('can retry from the failure state', () => {
        testTransition('failure', 'REQUEST_IDENTITY', 'requesting_identity')
    })

    test('can acknowledge session expiry', () => {
        testTransition('expired', 'ACKNOWLEDGE_EXPIRY', 'logging_in')
    })

    test('can initiate logout', () => {
        testTransition('logged_in', 'LOGOUT', 'logging_out')
    })

    test('when logout succeeds', () => {
        testTransition('logging_out', 'done.invoke.logout', 'login')
    })

    test('when logout fails', () => {
        testTransition('logging_out', 'error.platform.logout', 'failure')
    })
})