use candid::Principal;
use ic_cdk::api::call::{CallResult, RejectionCode};
use std::fmt::Debug;

pub use canister_client_macros::*;

pub async fn make_c2c_call<A, R, S, D, SError: Debug, DError: Debug>(
    canister_id: Principal,
    method_name: &str,
    args: &A,
    serializer: S,
    deserializer: D,
) -> CallResult<R>
where
    S: Fn(&A) -> Result<Vec<u8>, SError>,
    D: Fn(&[u8]) -> Result<R, DError>,
{
    let payload_bytes = prepare_request(args, serializer)?;

    tracing::trace!(method_name, %canister_id, "Starting c2c call");

    let response = ic_cdk::api::call::call_raw(canister_id, method_name, &payload_bytes, 0).await;

    process_response(canister_id, method_name, response, deserializer)
}

fn prepare_request<S: Fn(&T) -> Result<Vec<u8>, E>, T, E: Debug>(args: &T, serializer: S) -> CallResult<Vec<u8>> {
    fn map_err<E: Debug>(err: E) -> (RejectionCode, String) {
        (RejectionCode::CanisterError, format!("Serialization error: {:?}", err))
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
        (RejectionCode::CanisterError, format!("Deserialization error: {:?}", err))
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
