use crate::guards::caller_is_local_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::{Event as LocalUserIndexEvent, UserJoinedGroup};
use user_index_canister::c2c_notify_events::{Response::*, *};
use user_index_canister::Event;

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
            runtime_state.push_event_to_local_user_index(
                ev.user_id,
                LocalUserIndexEvent::UserJoinedGroup(UserJoinedGroup {
                    user_id: ev.user_id,
                    chat_id: ev.chat_id,
                    as_super_admin: false,
                    latest_message_index: ev.latest_message_index,
                }),
            );
        }
    }
}
