use crate::guards::caller_is_local_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notify_user_index_events::Event as LocalUserIndexEvent;
use user_index_canister::c2c_notify_events::{Response::*, *};

#[update_msgpack(guard = "caller_is_local_user_index_canister")]
#[trace]
fn c2c_notify_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_events_impl(args, state))
}

fn c2c_notify_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for event in args.events {
        handle_event(event, runtime_state);
    }

    Success
}

fn handle_event(event: Event, runtime_state: &mut RuntimeState) {
    match event {
        Event::UserJoinedGroup(ev) => {
            if let Some(index) = runtime_state.data.local_index_map.get_index_canister(&ev.user_id) {
                runtime_state
                    .data
                    .user_index_event_sync_queue
                    .push(index, LocalUserIndexEvent::UserJoinedGroup(ev));
            }
        }
    }
}
