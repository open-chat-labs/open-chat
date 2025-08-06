use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::reinstate_missed_daily_claims::*;
use oc_error_codes::OCErrorCode;
use user_canister::LocalUserIndexEvent;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn reinstate_missed_daily_claims(args: Args) -> Response {
    mutate_state(|state| reinstate_missed_daily_claims_impl(args, state))
}

fn reinstate_missed_daily_claims_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.push_event_to_user(
        args.user_id,
        LocalUserIndexEvent::ReinstateMissedDailyClaims(args.days),
        state.env.now(),
    ) {
        Response::Success
    } else {
        OCErrorCode::TargetUserNotFound.into()
    }
}
