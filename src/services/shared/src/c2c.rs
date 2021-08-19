use ic_cdk::api::call::CallResult;
use ic_cdk::export::candid::de::ArgumentDecoder;
use ic_cdk::export::candid::ser::ArgumentEncoder;
use ic_cdk::export::candid::Principal;
use log::error;

pub async fn call_with_logging<T: ArgumentEncoder, R: for<'a> ArgumentDecoder<'a>>(
    canister_id: Principal,
    method_name: &str,
    args: T,
) -> CallResult<R> {
    let result: CallResult<R> = ic_cdk::call(canister_id, method_name, args).await;

    if let Err(error) = &result {
        error!(
            "Error calling '{}': {:?}: {}",
            method_name, error.0, error.1
        );
    }

    result
}
