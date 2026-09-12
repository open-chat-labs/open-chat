use crate::guards::verify_caller_is_platform_operator;
use crate::jobs::generate_candidates;
use crate::model::schedule::validate_schedule;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::set_schedule::*;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

#[update(candid = true, msgpack = true)]
#[trace]
async fn set_schedule(args: Args) -> Response {
    if let Err(error) = verify_caller_is_platform_operator().await {
        return UnitResult::Error(error);
    }
    if let Err(message) = validate_schedule(&args.schedule) {
        return UnitResult::Error(OCErrorCode::InvalidRequest.with_message(message));
    }
    mutate_state(|state| {
        let now = state.env.now();
        state.data.set_schedule(args.schedule, now);
        generate_candidates::start_job_if_required(state);
    });
    UnitResult::Success
}
