use crate::types::CanisterId;
use candid::utils::{ArgumentDecoder, ArgumentEncoder};
use ic_cdk::api::call::CallResult;
use log::error;

pub async fn call_with_logging<T: ArgumentEncoder, R: for<'a> ArgumentDecoder<'a>>(
    canister_id: CanisterId,
    method_name: &str,
    args: T,
) -> CallResult<R> {
    let result: CallResult<R> = ic_cdk::call(canister_id, method_name, args).await;

    if let Err(error) = &result {
        error!("Error calling '{}': {:?}: {}", method_name, error.0, error.1);
    }

    result
}
