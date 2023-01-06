use crate::guards::caller_is_local_user_index;
use crate::{mutate_state, openchat_bot, RuntimeState, PREMIUM_GROUP_CREATION_LIMIT};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::UserEvent;
use user_canister::c2c_notify_user_events::{Response::*, *};

#[update_msgpack(guard = "caller_is_local_user_index")]
#[trace]
fn c2c_notify_user_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_events_impl(args, state))
}

fn c2c_notify_user_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
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
            openchat_bot::send_phone_number_confirmed_bot_message(&ev, runtime_state);
        }
        UserEvent::StorageUpgraded(ev) => {
            runtime_state.data.storage_limit = ev.new_storage_limit;
            runtime_state.data.group_creation_limit = PREMIUM_GROUP_CREATION_LIMIT;
            openchat_bot::send_storage_ugraded_bot_message(&ev, runtime_state);
        }
        UserEvent::ReferredUserRegistered(ev) => {
            openchat_bot::send_referred_user_joined_message(&ev, runtime_state);
        }
        UserEvent::UserSuspended(ev) => {
            openchat_bot::send_user_suspended_message(&ev, runtime_state);
        }
        UserEvent::OpenChatBotMessage(content) => openchat_bot::send_message(*content, false, runtime_state),
    }
}
