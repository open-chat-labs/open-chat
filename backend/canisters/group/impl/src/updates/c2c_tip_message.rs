use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use group_canister::c2c_tip_message::{Response::*, *};
use group_chat_core::TipMessageResult;
use ledger_utils::format_crypto_amount_with_symbol;
use types::{Achievement, Chat, EventIndex, GroupMessageTipped, Notification};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn c2c_tip_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_tip_message_impl(args, state))
}

fn c2c_tip_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return GroupFrozen;
    }

    let user_id = state.env.caller().into();
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

    match state
        .data
        .chat
        .tip_message(tip_message_args, &mut state.data.event_store_client)
    {
        TipMessageResult::Success => {
            if let Some((message, event_index)) = state.data.chat.events.message_internal(
                EventIndex::default(),
                args.thread_root_message_index,
                args.message_id.into(),
            ) {
                if let Some(sender) = state.data.chat.members.get(&message.sender) {
                    if message.sender != user_id && !sender.user_type().is_bot() {
                        let chat_id = state.env.canister_id().into();

                        state.push_notification(
                            vec![message.sender],
                            Notification::GroupMessageTipped(GroupMessageTipped {
                                chat_id,
                                thread_root_message_index: args.thread_root_message_index,
                                message_index: message.message_index,
                                message_event_index: event_index,
                                group_name: state.data.chat.name.value.clone(),
                                tipped_by: user_id,
                                tipped_by_name: args.username,
                                tipped_by_display_name: args.display_name,
                                tip: format_crypto_amount_with_symbol(args.amount, args.decimals, args.token.token_symbol()),
                                group_avatar_id: state.data.chat.avatar.as_ref().map(|a| a.id),
                            }),
                        );

                        state.data.user_event_sync_queue.push(
                            message.sender,
                            GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                                chat: Chat::Group(chat_id),
                                thread_root_message_index: args.thread_root_message_index,
                                message_index: message.message_index,
                                message_id: message.message_id,
                                event_index,
                                activity: MessageActivity::Tip,
                                timestamp: now,
                                user_id: Some(user_id),
                            }),
                        );

                        state
                            .data
                            .notify_user_of_achievement(message.sender, Achievement::HadMessageTipped);
                    }
                }
            }

            handle_activity_notification(state);
            Success
        }
        TipMessageResult::MessageNotFound => MessageNotFound,
        TipMessageResult::CannotTipSelf => CannotTipSelf,
        TipMessageResult::RecipientMismatch => RecipientMismatch,
        TipMessageResult::UserNotInGroup => UserNotInGroup,
        TipMessageResult::NotAuthorized => NotAuthorized,
        TipMessageResult::UserSuspended => UserSuspended,
        TipMessageResult::UserLapsed => UserLapsed,
    }
}
