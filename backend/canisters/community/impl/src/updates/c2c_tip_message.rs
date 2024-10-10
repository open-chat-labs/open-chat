use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use community_canister::c2c_tip_message::{Response::*, *};
use group_chat_core::TipMessageResult;
use ledger_utils::format_crypto_amount_with_symbol;
use types::{Achievement, ChannelMessageTipped, Chat, EventIndex, Notification};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn c2c_tip_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_tip_message_impl(args, state))
}

fn c2c_tip_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let user_id = state.env.caller().into();
    if let Some(member) = state.data.members.get_by_user_id(&user_id) {
        if member.suspended.value {
            return UserSuspended;
        } else if member.lapsed.value {
            return UserLapsed;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            let tip_message_args = TipMessageArgs {
                user_id,
                recipient: args.recipient,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                ledger: args.ledger,
                token: args.token.clone(),
                amount: args.amount,
                now,
            };

            match channel.chat.tip_message(tip_message_args, &mut state.data.event_store_client) {
                TipMessageResult::Success => {
                    if let Some((message, event_index)) = channel.chat.events.message_internal(
                        EventIndex::default(),
                        args.thread_root_message_index,
                        args.message_id.into(),
                    ) {
                        let community_id = state.env.canister_id().into();

                        state.data.user_event_sync_queue.push(
                            message.sender,
                            CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                                chat: Chat::Channel(community_id, channel.id),
                                thread_root_message_index: args.thread_root_message_index,
                                message_index: message.message_index,
                                activity: MessageActivity::Tip,
                                timestamp: now,
                                user_id,
                            }),
                        );

                        let notification = Notification::ChannelMessageTipped(ChannelMessageTipped {
                            community_id,
                            channel_id: channel.id,
                            thread_root_message_index: args.thread_root_message_index,
                            message_index: message.message_index,
                            message_event_index: event_index,
                            community_name: state.data.name.clone(),
                            channel_name: channel.chat.name.value.clone(),
                            tipped_by: user_id,
                            tipped_by_name: args.username,
                            tipped_by_display_name: args.display_name,
                            tip: format_crypto_amount_with_symbol(args.amount, args.decimals, args.token.token_symbol()),
                            community_avatar_id: state.data.avatar.as_ref().map(|a| a.id),
                            channel_avatar_id: channel.chat.avatar.as_ref().map(|a| a.id),
                        });
                        state.push_notification(vec![args.recipient], notification);
                    }

                    state
                        .data
                        .notify_user_of_achievement(args.recipient, Achievement::HadMessageTipped);

                    handle_activity_notification(state);
                    Success
                }
                TipMessageResult::MessageNotFound => MessageNotFound,
                TipMessageResult::CannotTipSelf => CannotTipSelf,
                TipMessageResult::RecipientMismatch => RecipientMismatch,
                TipMessageResult::UserNotInGroup => ChannelNotFound,
                TipMessageResult::NotAuthorized => NotAuthorized,
                TipMessageResult::UserSuspended => UserSuspended,
                TipMessageResult::UserLapsed => UserLapsed,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
