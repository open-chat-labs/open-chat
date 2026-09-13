use crate::guards::verify_caller_is_platform_operator;
use crate::jobs::push_puzzle;
use crate::model::schedule::validate_config;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::set_config::*;
use oc_error_codes::OCErrorCode;
use std::time::Duration;
use types::UnitResult;

#[update(candid = true, msgpack = true)]
#[trace]
async fn set_config(args: Args) -> Response {
    if let Err(error) = verify_caller_is_platform_operator().await {
        return UnitResult::Error(error);
    }
    if let Err(message) = validate_config(&args.config) {
        return UnitResult::Error(OCErrorCode::InvalidRequest.with_message(message));
    }
    mutate_state(|state| state.data.set_config(args.config));
    push_puzzle::schedule(true, Duration::ZERO);
    UnitResult::Success
}
