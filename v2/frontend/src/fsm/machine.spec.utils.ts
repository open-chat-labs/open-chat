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
) {
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
) {
    const configured = machine.withConfig(config);
    const nextState = configured.transition(from, ev);
    expect(nextState.value).toBe(to);
}

export function testSequence<TContext, TEvent extends EventObject>(
    sequence: string[],
    done: any,
    machine: StateMachine<TContext, any, TEvent>,
    assert: (state: State<TContext, TEvent, any, any>) => void
) {
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
