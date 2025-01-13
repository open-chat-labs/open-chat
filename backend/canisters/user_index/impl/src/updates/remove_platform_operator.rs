use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{PlatformOperatorStatusChanged, UserIndexEvent};
use user_index_canister::remove_platform_operator::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn remove_platform_operator(args: Args) -> Response {
    mutate_state(|state| {
        state.data.platform_operators.remove(&args.user_id);
        state.push_event_to_all_local_user_indexes(
            UserIndexEvent::PlatformOperatorStatusChanged(PlatformOperatorStatusChanged {
                user_id: args.user_id,
                is_platform_operator: false,
            }),
            None,
        );
    });

    Success
}
