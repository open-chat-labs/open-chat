use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState, PREMIUM_GROUP_CREATION_LIMIT};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use types::UserEvent;
use user_canister::c2c_notify_user_events::{Response::*, *};

#[update_candid_and_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_notify_user_event(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_user_event_impl(args, state))
}

fn c2c_notify_user_event_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, runtime_state);
    }
    Success
}

fn process_event(event: UserEvent, runtime_state: &mut RuntimeState) {
    match event {
        UserEvent::UsernameChanged(ev) => {
            runtime_state.data.username = ev.username;
        }
        UserEvent::PhoneNumberConfirmed(ev) => {
            runtime_state.data.phone_is_verified = true;
            runtime_state.data.storage_limit = ev.new_storage_limit;
            runtime_state.data.group_creation_limit = PREMIUM_GROUP_CREATION_LIMIT;
        }
        UserEvent::StorageUpgraded(ev) => {
            runtime_state.data.storage_limit = ev.new_storage_limit;
            runtime_state.data.group_creation_limit = PREMIUM_GROUP_CREATION_LIMIT;
        }
    }
}
