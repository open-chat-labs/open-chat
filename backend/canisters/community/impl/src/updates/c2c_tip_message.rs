use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use community_canister::c2c_tip_message::*;
use ledger_utils::format_crypto_amount_with_symbol;
use types::{Achievement, ChannelMessageTipped, Chat, EventIndex, OCResult, UserNotificationPayload};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn c2c_tip_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_tip_message_impl(args, state)).into()
}

fn c2c_tip_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_calling_member(true)?.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    let tip_message_args = TipMessageArgs {
        user_id,
        recipient: args.recipient,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        now,
    };

    channel
        .chat
        .tip_message(tip_message_args, &mut state.data.event_store_client)?;

    if let Some((message, event_index)) =
        channel
            .chat
            .events
            .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
    {
        if let Some(sender) = channel.chat.members.get(&message.sender) {
            if message.sender != user_id && !sender.user_type().is_bot() {
                let community_id = state.env.canister_id().into();
                let event = CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                    chat: Chat::Channel(community_id, channel.id),
                    thread_root_message_index: args.thread_root_message_index,
                    message_index: message.message_index,
                    message_id: message.message_id,
                    event_index,
                    activity: MessageActivity::Tip,
                    timestamp: now,
                    user_id: Some(user_id),
                });

                let notification = UserNotificationPayload::ChannelMessageTipped(ChannelMessageTipped {
                    community_id,
                    channel_id: channel.id,
                    thread_root_message_index: args.thread_root_message_index,
                    message_index: message.message_index,
                    message_event_index: event_index,
                    community_name: state.data.name.value.clone(),
                    channel_name: channel.chat.name.value.clone(),
                    tipped_by: user_id,
                    tipped_by_name: args.username,
                    tipped_by_display_name: args.display_name,
                    tip: format_crypto_amount_with_symbol(args.amount, args.decimals, &args.token_symbol),
                    community_avatar_id: state.data.avatar.as_ref().map(|a| a.id),
                    channel_avatar_id: channel.chat.avatar.as_ref().map(|a| a.id),
                });

                state.push_notification(Some(user_id), vec![message.sender], notification);
                state.push_event_to_user(message.sender, event, now);
                state.notify_user_of_achievement(message.sender, Achievement::HadMessageTipped, now);
            }
        }
    }

    handle_activity_notification(state);
    Ok(())
}
