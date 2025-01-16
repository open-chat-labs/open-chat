use crate::guards::caller_is_local_group_index;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_notify_events::*;
use group_canister::LocalGroupIndexEvent;
use types::Timestamped;

#[update(guard = "caller_is_local_group_index", msgpack = true)]
#[trace]
fn c2c_notify_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_events_impl(args, state))
}

fn c2c_notify_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, state);
    }
    Response::Success
}

fn process_event(event: LocalGroupIndexEvent, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        LocalGroupIndexEvent::NameChanged(ev) => {
            state.data.chat.name = Timestamped::new(ev.name, now);
        }
        LocalGroupIndexEvent::VerifiedChanged(ev) => {
            state.data.verified = Timestamped::new(ev.verified, now);
        }
    }
}
