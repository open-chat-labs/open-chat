use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use tracing::info;
use user_index_canister::set_call_push_enabled::*;

// The native call push kill switch (open-chat #9456). Recorded here and fanned out to every
// LocalUserIndex over the event queue, so a new LocalUserIndex is seeded with it and an existing
// one picks it up even if it is mid-upgrade. Each LocalUserIndex also keeps its own
// platform-operator `set_call_push_enabled` endpoint as a fallback.
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_call_push_enabled(args: Args) -> Response {
    mutate_state(|state| set_call_push_enabled_impl(args, state))
}

fn set_call_push_enabled_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.call_push_enabled = args.enabled;

    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetCallPushEnabled(args.enabled), None);

    info!("Native call push enabled set to {}", args.enabled);
    Response::Success
}
