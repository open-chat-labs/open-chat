#[macro_export]
macro_rules! generate_update_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            agent: &ic_agent::Agent,
            canister_id: &ic_principal::Principal,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, Box<dyn std::error::Error + Sync + std::marker::Send>> {
            let args_bytes = msgpack::serialize_to_vec(args)?;

            let method_name = concat!(stringify!($method_name), "_msgpack");
            let response = agent
                .update(canister_id, method_name)
                .with_arg(args_bytes)
                .call_and_wait()
                .await?;

            let result = msgpack::deserialize(response.as_slice())?;
            Ok(result)
        }
    };
}

#[macro_export]
macro_rules! generate_query_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            agent: &ic_agent::Agent,
            canister_id: &ic_principal::Principal,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, Box<dyn std::error::Error + std::marker::Send + std::marker::Sync>> {
            let args_bytes = msgpack::serialize_to_vec(args)?;

            let method_name = concat!(stringify!($method_name), "_msgpack");
            let response = agent
                .query(canister_id, method_name)
                .with_arg(args_bytes)
                .call()
                .await?;

            let result = msgpack::deserialize(response.as_slice())?;
            Ok(result)
        }
    };
}

#[macro_export]
macro_rules! generate_candid_update_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            agent: &ic_agent::Agent,
            canister_id: &candid::Principal,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, Box<dyn std::error::Error + Sync + std::marker::Send>> {
            use candid::{Decode, Encode};

            let candid_args = Encode!(args)?;

            let method_name = stringify!($method_name);
            let response = agent
                .update(canister_id, method_name)
                .with_arg(candid_args)
                .call_and_wait()
                .await?;

            let result = Decode!(response.as_slice(), $method_name::Response)?;
            Ok(result)
        }
    };
}

#[macro_export]
macro_rules! generate_candid_query_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            agent: &ic_agent::Agent,
            canister_id: &candid::Principal,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, Box<dyn std::error::Error + std::marker::Send + std::marker::Sync>> {
            use candid::{Decode, Encode};

            let candid_args = Encode!(args)?;

            let method_name = stringify!($method_name);
            let response = agent
                .query(canister_id, method_name)
                .with_arg(candid_args)
                .call()
                .await?;

            Ok(Decode!(response.as_slice(), $method_name::Response)?)
        }
    };
}

#[macro_export]
macro_rules! generate_c2c_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            canister_id: types::CanisterId,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, ::types::C2CError> {
            let method_name = concat!(stringify!($method_name), "_msgpack");

            canister_client::make_c2c_call(
                canister_id,
                method_name,
                args,
                msgpack::serialize_to_vec,
                |r| msgpack::deserialize_from_slice(r),
                None,
            )
            .await
        }
    };
    ($method_name:ident, $timeout_seconds:literal) => {
        pub async fn $method_name(
            canister_id: types::CanisterId,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, ::types::C2CError> {
            let method_name = concat!(stringify!($method_name), "_msgpack");

            canister_client::make_c2c_call(
                canister_id,
                method_name,
                args,
                msgpack::serialize_to_vec,
                |r| msgpack::deserialize_from_slice(r),
                Some($timeout_seconds),
            )
            .await
        }
    };
}

#[macro_export]
macro_rules! generate_c2c_call_ignore_response {
    ($method_name:ident) => {
        pub async fn $method_name(canister_id: types::CanisterId, args: &$method_name::Args) -> Result<(), ::types::C2CError> {
            let method_name = concat!(stringify!($method_name), "_msgpack");

            canister_client::make_c2c_call(
                canister_id,
                method_name,
                args,
                msgpack::serialize_to_vec,
                |_| Result::<(), ()>::Ok(()),
                None,
            )
            .await
        }
    };
}

#[macro_export]
macro_rules! generate_candid_c2c_call {
    ($method_name:ident) => {
        ::canister_client::generate_candid_c2c_call!($method_name, $method_name);
    };
    ($method_name:ident, $external_canister_method_name:ident) => {
        pub async fn $method_name(
            canister_id: ::types::CanisterId,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, ::types::C2CError> {
            let method_name = stringify!($external_canister_method_name);

            canister_client::make_c2c_call(
                canister_id,
                method_name,
                args,
                ::candid::encode_one,
                |r| ::candid::decode_one(r),
                None,
            )
            .await
        }
    };
}

#[macro_export]
macro_rules! generate_candid_c2c_call_with_payment {
    ($method_name:ident) => {
        pub async fn $method_name(
            canister_id: ::types::CanisterId,
            args: &$method_name::Args,
            cycles: ::types::Cycles,
        ) -> Result<$method_name::Response, ::types::C2CError> {
            let method_name = stringify!($method_name);

            canister_client::make_c2c_call_with_payment(
                canister_id,
                method_name,
                args,
                ::candid::encode_one,
                |r| ::candid::decode_one(r),
                cycles,
            )
            .await
        }
    };
}

#[macro_export]
macro_rules! generate_candid_c2c_call_tuple_args {
    ($method_name:ident) => {
        ::canister_client::generate_candid_c2c_call_tuple_args!($method_name, $method_name);
    };
    ($method_name:ident, $external_canister_method_name:ident) => {
        pub async fn $method_name(
            canister_id: ::types::CanisterId,
            args: $method_name::Args,
        ) -> Result<$method_name::Response, ::types::C2CError> {
            let method_name = stringify!($external_canister_method_name);

            canister_client::make_c2c_call(
                canister_id,
                method_name,
                args,
                ::candid::encode_args,
                |r| ::candid::decode_args(r),
                None,
            )
            .await
        }
    };
}

#[macro_export]
macro_rules! generate_candid_c2c_call_no_args {
    ($method_name:ident) => {
        ::canister_client::generate_candid_c2c_call_no_args!($method_name, $method_name);
    };
    ($method_name:ident, $external_canister_method_name:ident) => {
        pub async fn $method_name(canister_id: ::types::CanisterId) -> Result<$method_name::Response, ::types::C2CError> {
            let method_name = stringify!($external_canister_method_name);

            canister_client::make_c2c_call(
                canister_id,
                method_name,
                (),
                ::candid::encode_one,
                |r| ::candid::decode_one(r),
                None,
            )
            .await
        }
    };
}
