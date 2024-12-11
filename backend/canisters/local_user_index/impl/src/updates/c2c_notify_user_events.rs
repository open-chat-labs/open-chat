use crate::guards::caller_is_local_user_canister;
use crate::{mutate_state, RuntimeState, UserIndexEvent};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notify_user_events::{Response::*, *};
use local_user_index_canister::UserEvent;
use types::UserId;

#[update(guard = "caller_is_local_user_canister", msgpack = true)]
#[trace]
fn c2c_notify_user_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_events_impl(args, state))
}

fn c2c_notify_user_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = state.env.caller().into();
    for event in args.events {
        handle_event(user_id, event, state);
    }
    Success
}

fn handle_event(user_id: UserId, event: UserEvent, state: &mut RuntimeState) {
    match event {
        UserEvent::NotifyChit(ev) => {
            state.push_event_to_user_index(UserIndexEvent::NotifyChit(Box::new((user_id, ev))));
        }
    }
}
