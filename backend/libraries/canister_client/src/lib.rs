use candid::Principal;
use ic_cdk::call::RejectCode;
use std::fmt::Debug;
use tracing::Level;

pub use canister_client_macros::*;
use types::{C2CError, C2CRetryPolicy};

// Serializing our own args, or deserializing the callee's response, will fail the same way however
// many times we retry - either the caller and callee disagree on the types, or one of them has a
// bug. Neither is fixable without a deploy, so these must not go back on a retry queue. This
// mirrors how the CDK's own `CandidDecodeFailed` is treated by `C2CError::from_cdk_error`.
fn encoding_error(canister_id: Principal, method_name: &str, description: &str, error: impl Debug) -> C2CError {
    C2CError::new_with_retry_policy(
        canister_id,
        method_name,
        RejectCode::CanisterError,
        format!("{description}: {error:?}"),
        C2CRetryPolicy::DoNotRetry,
    )
}

pub async fn make_c2c_call<A, R, S, D, SError: Debug, DError: Debug>(
    canister_id: Principal,
    method_name: &str,
    args: A,
    serializer: S,
    deserializer: D,
    timeout_seconds: Option<u32>,
) -> Result<R, C2CError>
where
    S: Fn(A) -> Result<Vec<u8>, SError>,
    D: Fn(&[u8]) -> Result<R, DError>,
{
    let payload_bytes = serializer(args).map_err(|e| encoding_error(canister_id, method_name, "Serialization error", e))?;

    let response_bytes = make_c2c_call_raw(canister_id, method_name, &payload_bytes, 0, timeout_seconds).await?;

    deserializer(&response_bytes).map_err(|e| encoding_error(canister_id, method_name, "Deserialization error", e))
}

pub async fn make_c2c_call_with_payment<A, R, S, D, SError: Debug, DError: Debug>(
    canister_id: Principal,
    method_name: &str,
    args: A,
    serializer: S,
    deserializer: D,
    cycles: u128,
) -> Result<R, C2CError>
where
    S: Fn(A) -> Result<Vec<u8>, SError>,
    D: Fn(&[u8]) -> Result<R, DError>,
{
    let payload_bytes = serializer(args).map_err(|e| encoding_error(canister_id, method_name, "Serialization error", e))?;

    let response_bytes = make_c2c_call_raw(canister_id, method_name, &payload_bytes, cycles, None).await?;

    deserializer(&response_bytes).map_err(|e| encoding_error(canister_id, method_name, "Deserialization error", e))
}

pub async fn make_c2c_call_raw(
    canister_id: Principal,
    method_name: &str,
    payload_bytes: &[u8],
    cycles: u128,
    timeout_seconds: Option<u32>,
) -> Result<Vec<u8>, C2CError> {
    let tracing_enabled = tracing::enabled!(Level::TRACE);
    if tracing_enabled {
        tracing::trace!(method_name, %canister_id, "Starting c2c call");
        ic_cdk::println!("Making call to {canister_id} \"{method_name}\"");
    }

    let call = if let Some(timeout_seconds) = timeout_seconds {
        ic_cdk::call::Call::bounded_wait(canister_id, method_name).change_timeout(timeout_seconds)
    } else {
        ic_cdk::call::Call::unbounded_wait(canister_id, method_name)
    };

    let response = call.with_raw_args(payload_bytes).with_cycles(cycles).await;

    match response {
        Ok(response_bytes) => {
            tracing::trace!(method_name, %canister_id, "Completed c2c call successfully");
            Ok(response_bytes.into_bytes())
        }
        Err(error) => {
            // Convert via `C2CError::from_cdk_error` rather than flattening the error here, so that
            // the retry policy is derived from the CDK's own view of the failure. Eg. a callee which
            // is out of cycles is just another `SysTransient` reject once flattened, and retrying
            // that every round burns our own cycles until someone tops the callee up.
            let error = C2CError::from_cdk_error(canister_id, method_name, error.into());
            tracing::error!(
                method_name,
                %canister_id,
                error_code = ?error.reject_code(),
                error_message = error.message(),
                "Error calling c2c"
            );
            Err(error)
        }
    }
}
