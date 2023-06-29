#[macro_export]
macro_rules! canister_state {
    ($type:ty) => {
        thread_local! {
            static __STATE: std::cell::RefCell<Option<$type>> = std::cell::RefCell::default();
        }

        const __STATE_ALREADY_INITIALIZED: &str = "State has already been initialized";
        const __STATE_NOT_INITIALIZED: &str = "State has not been initialized";

        fn init_state(state: $type) {
            __STATE.with(|s| {
                if s.borrow().is_some() {
                    panic!("{}", __STATE_ALREADY_INITIALIZED);
                } else {
                    *s.borrow_mut() = Some(state);
                }
            });
        }

        fn replace_state(state: $type) -> $type {
            __STATE
                .with(|s| s.replace(Some(state)))
                .expect(__STATE_NOT_INITIALIZED)
        }

        fn take_state() -> $type {
            __STATE.with(|s| s.take()).expect(__STATE_NOT_INITIALIZED)
        }

        fn read_state<F, R>(f: F) -> R
        where
            F: FnOnce(&$type) -> R,
        {
            __STATE.with(|s| f(s.borrow().as_ref().expect(__STATE_NOT_INITIALIZED)))
        }

        fn mutate_state<F, R>(f: F) -> R
        where
            F: FnOnce(&mut $type) -> R,
        {
            __STATE.with(|s| f(s.borrow_mut().as_mut().expect(__STATE_NOT_INITIALIZED)))
        }

        fn can_borrow_state() -> bool {
            __STATE.with(|s| s.try_borrow().is_ok())
        }
    };
}
