use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_notify_group_index_events::{Args, GroupIndexEvent, Response};
use tracing::info;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_notify_group_index_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_group_index_events_impl(args, state))
}

fn c2c_notify_group_index_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for event in args.events {
        handle_event(event, runtime_state);
    }

    Response::Success
}

fn handle_event(event: GroupIndexEvent, runtime_state: &mut RuntimeState) {
    match event {
        GroupIndexEvent::MaxConcurrentCanisterUpgradesChanged(ev) => {
            runtime_state.data.max_concurrent_canister_upgrades = ev.value;
            info!("Max concurrent canister upgrades set to {}", ev.value);
        }
        GroupIndexEvent::LocalGroupAdded(ev) => {
            runtime_state.data.local_groups.add(ev.chat_id, ev.wasm_version);
        }
    }
}
