#[macro_export]
macro_rules! state_operations {
    () => {
        fn set_state(runtime_state: RuntimeState) {
            RUNTIME_STATE.with(|state| *state.borrow_mut() = Some(runtime_state));
        }

        fn take_state() -> RuntimeState {
            RUNTIME_STATE.with(|state| state.take().unwrap())
        }

        fn read_state<F, R>(f: F) -> R
        where
            F: FnOnce(&RuntimeState) -> R,
        {
            RUNTIME_STATE.with(|state| f(state.borrow().as_ref().unwrap()))
        }

        fn mutate_state<F, R>(f: F) -> R
        where
            F: FnOnce(&mut RuntimeState) -> R,
        {
            RUNTIME_STATE.with(|state| f(state.borrow_mut().as_mut().unwrap()))
        }
    };
}
