use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use tracing::info;
use user_index_canister::set_mini_app_service_principal::*;

// The MiniApp service's principal, the only caller the LocalUserIndexes let post a MiniApp card or
// write its players, status and result. A platform operator sets it from the website's admin page.
// Recorded here and fanned out to every LocalUserIndex over the event queue, so a new
// LocalUserIndex is seeded with it.
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_mini_app_service_principal(args: Args) -> Response {
    mutate_state(|state| set_mini_app_service_principal_impl(args, state))
}

fn set_mini_app_service_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.mini_app_service_principal = Some(args.principal);

    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetMiniAppServicePrincipal(args.principal), None);

    info!(principal = %args.principal, "MiniApp service principal set");
    Response::Success
}
