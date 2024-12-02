use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use bot_api_gateway_canister::c2c_notify_user_index_events::{Response::*, *};
use bot_api_gateway_canister::Event;
use canister_api_macros::update;
use canister_tracing_macros::trace;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_notify_user_index_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_index_events_impl(args, state))
}

fn c2c_notify_user_index_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        handle_event(event, state);
    }
    Success
}

fn handle_event(event: Event, state: &mut RuntimeState) {
    match event {
        Event::BotRegistered(ev) => {
            state.data.bots.set(ev.user_principal, ev.user_id, ev.name, ev.commands);
        }
    }
}
