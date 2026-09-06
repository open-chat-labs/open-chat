use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{PlatformOperatorStatusChanged, UserIndexEvent};
use user_index_canister::add_platform_operator::*;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn add_platform_operator(args: Args) -> Response {
    mutate_state(|state| {
        state.data.platform_operators.insert(args.user_id);
        // A suspended appointee joins the set but the live flag stays off until the
        // suspension lifts (sync_suspended_privileges restores it)
        let suspended = state
            .data
            .users
            .get_by_user_id(&args.user_id)
            .is_some_and(|u| u.suspension_details.is_some());
        state.push_event_to_all_local_user_indexes(
            UserIndexEvent::PlatformOperatorStatusChanged(PlatformOperatorStatusChanged {
                user_id: args.user_id,
                is_platform_operator: !suspended,
            }),
            None,
        );
    });

    Response::Success
}
