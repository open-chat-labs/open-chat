use crate::guards::caller_is_local_user_index;
use crate::updates::leave_group;
use crate::{mutate_state, openchat_bot, RuntimeState, PREMIUM_GROUP_CREATION_LIMIT};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_user_events::{Response::*, *};
use user_canister::Event;

#[update_msgpack(guard = "caller_is_local_user_index")]
#[trace]
fn c2c_notify_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_events_impl(args, state))
}

#[update_msgpack(guard = "caller_is_local_user_index")]
#[trace]
fn c2c_notify_user_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_events_impl(args, state))
}

fn c2c_notify_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, runtime_state);
    }
    Success
}

fn process_event(event: Event, runtime_state: &mut RuntimeState) {
    match event {
        Event::UsernameChanged(ev) => {
            runtime_state.data.username = ev.username;
        }
        Event::PhoneNumberConfirmed(ev) => {
            runtime_state.data.phone_is_verified = true;
            runtime_state.data.storage_limit = ev.new_storage_limit;
            runtime_state.data.group_creation_limit = PREMIUM_GROUP_CREATION_LIMIT;
            openchat_bot::send_phone_number_confirmed_bot_message(&ev, runtime_state);
        }
        Event::StorageUpgraded(ev) => {
            runtime_state.data.storage_limit = ev.new_storage_limit;
            runtime_state.data.group_creation_limit = PREMIUM_GROUP_CREATION_LIMIT;
            openchat_bot::send_storage_ugraded_bot_message(&ev, runtime_state);
        }
        Event::ReferredUserRegistered(ev) => {
            openchat_bot::send_referred_user_joined_message(&ev, runtime_state);
        }
        Event::UserSuspended(ev) => {
            openchat_bot::send_user_suspended_message(&ev, runtime_state);
        }
        Event::OpenChatBotMessage(content) => openchat_bot::send_message(*content, false, runtime_state),
        Event::UserJoinedGroup(ev) => {
            let now = runtime_state.env.now();

            // Temporary hack
            // TODO remove this
            leave_group::commit(ev.chat_id, runtime_state);

            runtime_state
                .data
                .group_chats
                .join(ev.chat_id, ev.as_super_admin, ev.latest_message_index, now);

            runtime_state.data.recommended_group_exclusions.remove(&ev.chat_id, now);
        }
    }
}
