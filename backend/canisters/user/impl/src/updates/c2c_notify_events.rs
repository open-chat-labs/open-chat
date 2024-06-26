use crate::guards::caller_is_local_user_index;
use crate::{mutate_state, openchat_bot, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::{Achievement, ChitEarnedReason, DiamondMembershipPlanDuration, MessageContentInitial, Timestamped};
use user_canister::c2c_notify_events::{Response::*, *};
use user_canister::mark_read::ChannelMessagesRead;
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
            let now = state.env.now();
            state.data.username = Timestamped::new(ev.username, now);
        }
        Event::DisplayNameChanged(ev) => {
            let now = state.env.now();
            state.data.display_name = Timestamped::new(ev.display_name, now);
            state.insert_achievement(types::Achievement::SetDisplayName);
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
            let initial_content: MessageContentInitial = (*content).into();
            openchat_bot::send_message(initial_content.into(), Vec::new(), false, state);
        }
        Event::OpenChatBotMessageV2(message) => {
            openchat_bot::send_message(message.content.into(), message.mentioned, false, state);
        }
        Event::UserJoinedGroup(ev) => {
            let now = state.env.now();
            state
                .data
                .group_chats
                .join(ev.chat_id, ev.local_user_index_canister_id, ev.latest_message_index, now);
            state.data.hot_group_exclusions.remove(&ev.chat_id, now);
            state.insert_achievement(types::Achievement::JoinedGroup);
        }
        Event::UserJoinedCommunityOrChannel(ev) => {
            let now = state.env.now();
            let (community, _) = state
                .data
                .communities
                .join(ev.community_id, ev.local_user_index_canister_id, now);
            community.mark_read(
                ev.channels
                    .into_iter()
                    .map(|c| ChannelMessagesRead {
                        channel_id: c.channel_id,
                        read_up_to: c.latest_message_index,
                        threads: Vec::new(),
                        date_read_pinned: None,
                    })
                    .collect(),
                now,
            );
            state.insert_achievement(types::Achievement::JoinedCommunity);
        }
        Event::DiamondMembershipPaymentReceived(ev) => {
            state.insert_achievement(types::Achievement::UpgradedToDiamond);

            if matches!(ev.duration, DiamondMembershipPlanDuration::Lifetime) {
                state.insert_achievement(types::Achievement::UpgradedToGoldDiamond);
            }

            state.data.diamond_membership_expires_at = Some(ev.expires_at);

            if ev.send_bot_message {
                openchat_bot::send_text_message(
                    "Payment received for Diamond membership!".to_string(),
                    Vec::new(),
                    false,
                    state,
                );
            }
        }
        Event::ChitEarned(ev) => {
            let timestamp = ev.timestamp;
            let is_daily_claim = matches!(ev.reason, ChitEarnedReason::DailyClaim);

            state.data.chit_events.push(*ev);

            if is_daily_claim {
                let streak = state.data.chit_events.streak(timestamp);

                if streak >= 3 {
                    state.insert_achievement(Achievement::Streak3);
                }

                if streak >= 7 {
                    state.insert_achievement(Achievement::Streak7);
                }

                if streak >= 14 {
                    state.insert_achievement(Achievement::Streak14);
                }

                if streak >= 30 {
                    state.insert_achievement(Achievement::Streak30);
                }
            }
        }
    }
}
