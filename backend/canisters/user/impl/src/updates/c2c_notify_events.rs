use crate::guards::caller_is_local_user_index;
use crate::{mutate_state, openchat_bot, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_user_events::{Response::*, *};
use user_canister::Event;

#[update_msgpack(guard = "caller_is_local_user_index")]
#[trace]
fn c2c_notify_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_events_impl(args, state))
}

fn c2c_notify_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, state);
    }
    Success
}

fn process_event(event: Event, state: &mut RuntimeState) {
    match event {
        Event::UsernameChanged(ev) => {
            state.data.username = ev.username;
        }
        Event::PhoneNumberConfirmed(ev) => {
            state.data.phone_is_verified = true;
            state.data.storage_limit = ev.new_storage_limit;
            openchat_bot::send_phone_number_confirmed_bot_message(&ev, state);
        }
        Event::StorageUpgraded(ev) => {
            state.data.storage_limit = ev.new_storage_limit;
            openchat_bot::send_storage_ugraded_bot_message(&ev, state);
        }
        Event::ReferredUserRegistered(ev) => {
            openchat_bot::send_referred_user_joined_message(&ev, state);
        }
        Event::UserSuspended(ev) => {
            openchat_bot::send_user_suspended_message(&ev, state);
        }
        Event::OpenChatBotMessage(content) => {
            openchat_bot::send_message(*content, false, state);
        }
        Event::UserJoinedGroup(ev) => {
            let now = state.env.now();
            state.data.group_chats.join(ev.chat_id, ev.latest_message_index, now);
            state.data.hot_group_exclusions.remove(&ev.chat_id, now);
        }
        Event::UserJoinedCommunity(ev) => {
            let now = state.env.now();
            state.data.communities.join(ev.community_id, now);
        }
        Event::DiamondMembershipPaymentReceived(ev) => {
            state.data.diamond_membership_expires_at = Some(ev.expires_at);

            if ev.send_bot_message {
                openchat_bot::send_text_message("Payment received for Diamond membership!".to_string(), false, state);
            }
        }
    }
}
