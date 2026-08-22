use candid::Principal;
use ic_cdk::call::RejectCode;
use std::fmt::Debug;
use tracing::Level;

pub use canister_client_macros::*;
use types::{C2CError, C2CRetryPolicy, Cycles};

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

// Makes a c2c call, attaching as much of the canister's liquid cycles balance as can safely be
// spared. This is for canisters which are about to be deleted: deleting a canister destroys
// whatever cycles it still holds, so it refunds them to the callee along with its final call.
pub async fn make_c2c_call_raw_refunding_spare_cycles(
    canister_id: Principal,
    method_name: &str,
    payload_bytes: &[u8],
) -> Result<Vec<u8>, C2CError> {
    let call_cost = ic_cdk::api::cost_call(method_name.len() as u64, payload_bytes.len() as u64);
    let refund = refund_amount(ic_cdk::api::canister_liquid_cycle_balance(), call_cost);

    make_c2c_call_raw(canister_id, method_name, payload_bytes, refund, None).await
}

// Headroom kept back beyond the cost of the call itself, for the canister to keep operating until
// it is actually deleted - executing the response to its final call, then being stopped and
// deleted - and to absorb any charges which fall outside the estimate (eg. storage reservations
// on a memory-pressured subnet). The refund fails the call carrying it if the balance dips below
// the freezing threshold at any point along the way, so this is cheap insurance relative to the
// balance being refunded.
const REFUND_HEADROOM: Cycles = 20_000_000_000; // 20B

fn refund_amount(liquid_balance: Cycles, call_cost: Cycles) -> Cycles {
    liquid_balance.saturating_sub(call_cost.saturating_add(REFUND_HEADROOM))
}

#[cfg(test)]
mod tests {
    use super::*;

    const B: Cycles = 1_000_000_000;

    #[test]
    fn refund_keeps_back_the_call_cost_plus_the_headroom() {
        assert_eq!(refund_amount(600 * B, 3 * B), 577 * B);
    }

    #[test]
    fn no_refund_when_the_balance_is_below_the_amount_kept_back() {
        assert_eq!(refund_amount(20 * B, 3 * B), 0);
        assert_eq!(refund_amount(0, 3 * B), 0);
    }
}
