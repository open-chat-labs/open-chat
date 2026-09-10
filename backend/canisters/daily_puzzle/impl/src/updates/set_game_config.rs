use crate::guards::caller_is_governance_principal;
use crate::jobs::push_puzzle;
use crate::model::schedule::validate_game_config;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::set_game_config::*;
use oc_error_codes::OCErrorCode;
use std::time::Duration;
use types::UnitResult;

#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn set_game_config(args: Args) -> Response {
    if let Err(message) = validate_game_config(&args.config) {
        return UnitResult::Error(OCErrorCode::InvalidRequest.with_message(message));
    }
    mutate_state(|state| state.data.set_game_config(args.game_id, args.config));
    push_puzzle::schedule(true, Duration::ZERO);
    UnitResult::Success
}
