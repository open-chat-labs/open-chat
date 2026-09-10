use crate::guards::caller_is_governance_principal;
use crate::jobs::generate_candidates;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::veto_candidate::*;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn veto_candidate(args: Args) -> Response {
    mutate_state(|state| {
        if state.data.veto_candidate(args.number, &args.game_id, args.index) {
            generate_candidates::start_job_if_required(state);
            UnitResult::Success
        } else {
            UnitResult::Error(OCErrorCode::ItemNotFound.into())
        }
    })
}
