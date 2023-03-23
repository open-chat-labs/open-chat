#[macro_export]
macro_rules! generate_query_call {
    ($method_name:ident) => {
        #[allow(dead_code)]
        pub fn $method_name(
            env: &ic_test_state_machine_client::StateMachine,
            sender: candid::Principal,
            canister_id: candid::Principal,
            args: &$method_name::Args,
        ) -> $method_name::Response {
            let method_name = stringify!($method_name);

            $crate::client::execute_query(env, sender, canister_id, method_name, args)
        }
    };
}

#[macro_export]
macro_rules! generate_update_call {
    ($method_name:ident) => {
        #[allow(dead_code)]
        pub fn $method_name(
            env: &mut ic_test_state_machine_client::StateMachine,
            sender: candid::Principal,
            canister_id: candid::Principal,
            args: &$method_name::Args,
        ) -> $method_name::Response {
            let method_name = stringify!($method_name);

            $crate::client::execute_update(env, sender, canister_id, method_name, args)
        }
    };
}
