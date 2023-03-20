use candid::{CandidType, Principal};
use ic_cdk::api::call::{CallResult, RejectionCode};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fmt::Debug;

#[macro_export]
macro_rules! generate_update_call {
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
macro_rules! generate_query_call {
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
        ) -> ic_cdk::api::call::CallResult<$method_name::Response> {
            let method_name = concat!(stringify!($method_name), "_msgpack");
            let payload_bytes = $crate::prepare_msgpack_request(args)?;

            tracing::trace!(method_name, %canister_id, "Starting c2c call");

            let response = ic_cdk::api::call::call_raw(canister_id, method_name, &payload_bytes, 0).await;

            $crate::process_msgpack_response(canister_id, method_name, response)
        }
    };
}

#[macro_export]
macro_rules! generate_candid_c2c_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            canister_id: types::CanisterId,
            args: &$method_name::Args,
        ) -> ic_cdk::api::call::CallResult<$method_name::Response> {
            let method_name = stringify!($method_name);
            let payload_bytes = $crate::prepare_candid_request(args)?;

            tracing::trace!(method_name, %canister_id, "Starting c2c call");

            let response = ic_cdk::api::call::call_raw(canister_id, method_name, &payload_bytes, 0).await;

            $crate::process_candid_response(canister_id, method_name, response)
        }
    };
}

pub fn prepare_candid_request<T: CandidType>(args: &T) -> CallResult<Vec<u8>> {
    prepare_request(args, |r| candid::encode_one(r))
}

pub fn process_candid_response<T: CandidType + DeserializeOwned>(
    canister_id: Principal,
    method_name: &str,
    response: CallResult<Vec<u8>>,
) -> CallResult<T> {
    process_response(canister_id, method_name, response, |r| candid::decode_one(r))
}

pub fn prepare_msgpack_request<T: Serialize>(args: &T) -> CallResult<Vec<u8>> {
    prepare_request(args, |r| msgpack::serialize(r))
}

pub fn process_msgpack_response<T: DeserializeOwned>(
    canister_id: Principal,
    method_name: &str,
    response: CallResult<Vec<u8>>,
) -> CallResult<T> {
    process_response(canister_id, method_name, response, |r| msgpack::deserialize(r))
}

fn prepare_request<S: Fn(&T) -> Result<Vec<u8>, E>, T, E: Debug>(args: &T, serializer: S) -> CallResult<Vec<u8>> {
    fn map_err<E: Debug>(err: E) -> (RejectionCode, String) {
        (
            ic_cdk::api::call::RejectionCode::CanisterError,
            format!("Serialization error: {:?}", err),
        )
    }

    serializer(args).map_err(map_err)
}

fn process_response<D: Fn(&[u8]) -> Result<T, E>, T, E: Debug>(
    canister_id: Principal,
    method_name: &str,
    response: CallResult<Vec<u8>>,
    deserializer: D,
) -> CallResult<T> {
    fn map_err<E: Debug>(err: E) -> (RejectionCode, String) {
        (
            ic_cdk::api::call::RejectionCode::CanisterError,
            format!("Deserialization error: {:?}", err),
        )
    }

    match response {
        Ok(result) => {
            tracing::trace!(method_name, %canister_id, "Completed c2c call successfully");
            deserializer(&result).map_err(map_err)
        }
        Err((error_code, error_message)) => {
            tracing::error!(method_name, %canister_id, ?error_code, error_message, "Error calling c2c");
            Err((error_code, error_message))
        }
    }
}
