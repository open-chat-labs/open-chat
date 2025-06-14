#[macro_export]
macro_rules! generate_query_call {
    ($method_name:ident) => {
        pub fn $method_name(
            env: &pocket_ic::PocketIc,
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
macro_rules! generate_msgpack_query_call {
    ($method_name:ident) => {
        pub fn $method_name(
            env: &pocket_ic::PocketIc,
            sender: candid::Principal,
            canister_id: candid::Principal,
            args: &$method_name::Args,
        ) -> $method_name::Response {
            let method_name = concat!(stringify!($method_name), "_msgpack");

            $crate::client::execute_msgpack_query(env, sender, canister_id, &method_name, args)
        }
    };
}

#[macro_export]
macro_rules! generate_update_call {
    ($method_name:ident) => {
        pub fn $method_name(
            env: &mut pocket_ic::PocketIc,
            sender: candid::Principal,
            canister_id: candid::Principal,
            args: &$method_name::Args,
        ) -> $method_name::Response {
            let method_name = stringify!($method_name);

            $crate::client::execute_update(env, sender, canister_id, method_name, args)
        }
    };
}

#[macro_export]
macro_rules! generate_msgpack_update_call {
    ($method_name:ident) => {
        pub fn $method_name(
            env: &mut pocket_ic::PocketIc,
            sender: candid::Principal,
            canister_id: candid::Principal,
            args: &$method_name::Args,
        ) -> $method_name::Response {
            let method_name = concat!(stringify!($method_name), "_msgpack");

            $crate::client::execute_msgpack_update(env, sender, canister_id, &method_name, args)
        }
    };
}
