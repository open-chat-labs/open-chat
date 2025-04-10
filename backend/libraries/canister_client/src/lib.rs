use candid::Principal;
use ic_cdk::call::{CallFailed, RejectCode};
use std::fmt::Debug;
use tracing::Level;

pub use canister_client_macros::*;
use types::C2CError;

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
    let payload_bytes = serializer(args).map_err(|e| {
        C2CError::new(
            canister_id,
            method_name,
            RejectCode::CanisterError,
            format!("Serialization error: {:?}", e),
        )
    })?;

    let response_bytes = make_c2c_call_raw(canister_id, method_name, &payload_bytes, 0, timeout_seconds).await?;

    deserializer(&response_bytes).map_err(|e| {
        C2CError::new(
            canister_id,
            method_name,
            RejectCode::CanisterError,
            format!("Deserialization error: {:?}", e),
        )
    })
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
    let payload_bytes = serializer(args).map_err(|e| {
        C2CError::new(
            canister_id,
            method_name,
            RejectCode::CanisterError,
            format!("Serialization error: {:?}", e),
        )
    })?;

    let response_bytes = make_c2c_call_raw(canister_id, method_name, &payload_bytes, cycles, None).await?;

    deserializer(&response_bytes).map_err(|e| {
        C2CError::new(
            canister_id,
            method_name,
            RejectCode::CanisterError,
            format!("Deserialization error: {:?}", e),
        )
    })
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
            let (error_code, error_message) = match error {
                CallFailed::InsufficientLiquidCycleBalance(cb) => (RejectCode::SysTransient, cb.to_string()),
                CallFailed::CallPerformFailed(f) => (RejectCode::SysUnknown, f.to_string()),
                CallFailed::CallRejected(r) => (
                    r.reject_code().unwrap_or(RejectCode::SysUnknown),
                    r.reject_message().to_string(),
                ),
            };
            tracing::error!(method_name, %canister_id, ?error_code, error_message, "Error calling c2c");
            Err(C2CError::new(canister_id, method_name, error_code, error_message))
        }
    }
}
