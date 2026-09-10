use crate::guards::caller_is_governance_principal;
use crate::jobs::generate_candidates;
use crate::model::schedule::validate_schedule;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::set_schedule::*;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn set_schedule(args: Args) -> Response {
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
