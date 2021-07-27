/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    Event,
    EventObject,
    interpret,
    MachineOptions,
    State,
    StateMachine,
    StateValue,
} from "xstate";

type Config<TContext, TEvents extends EventObject> = Partial<MachineOptions<TContext, TEvents>>;

export function updateConfig<TContext, TEvents extends EventObject>(
    defaultConfig: Config<TContext, TEvents>,
    partialGuards: any = {},
    partialServices: any = {}
): Config<TContext, TEvents> {
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

export function testTransition<TContext, TEvent extends EventObject>(
    machine: StateMachine<TContext, any, TEvent>,
    from: StateValue,
    ev: Event<TEvent>,
    to: StateValue,
    config: Config<TContext, TEvent> = {}
): TContext {
    const configured = machine.withConfig(config);
    const nextState = configured.transition(from, ev);
    expect(nextState.matches(to)).toBe(true);
    return nextState.context;
}

export function testSequence<TContext, TEvent extends EventObject>(
    sequence: string[],
    done: any,
    machine: StateMachine<TContext, any, TEvent>,
    assert: (state: State<TContext, TEvent, any, any>) => void
): void {
    const service = interpret(machine).onTransition((state) => {
        const nextState = sequence.shift();
        expect(state.matches(nextState)).toBe(true);
        if (sequence.length === 0) {
            try {
                assert(state);
                done();
            } catch (err) {
                done(err);
            } finally {
                service.stop();
            }
        }
    });

    service.start();
}
