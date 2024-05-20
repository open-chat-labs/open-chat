use crate::model::direct_chat::DirectChat;
use crate::timer_job_types::{HardDeleteMessageContentJob, TimerJob};
use crate::updates::c2c_send_messages::{get_sender_status, handle_message_impl, verify_user, HandleMessageArgs};
use crate::updates::start_video_call::handle_start_video_call;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{
    AddRemoveReactionArgs, AddRemoveReactionResult, DeleteMessageResult, DeleteUndeleteMessagesArgs, EditMessageArgs, Reader,
    TipMessageArgs, TipMessageResult,
};
use event_store_producer_cdk_runtime::CdkRuntime;
use ledger_utils::format_crypto_amount_with_symbol;
use types::{DirectMessageTipped, DirectReactionAddedNotification, EventIndex, Notification, UserId, VideoCallPresence};
use user_canister::c2c_notify_user_canister_events::{Response::*, *};
use user_canister::{SendMessagesArgs, ToggleReactionArgs, UserCanisterEvent};
use utils::time::{HOUR_IN_MS, MINUTE_IN_MS};

#[update_msgpack]
#[trace]
async fn c2c_notify_user_canister_events(args: Args) -> Response {
    run_regular_jobs();

    let caller_user_id = match read_state(get_sender_status) {
        crate::updates::c2c_send_messages::SenderStatus::Ok(user_id) => user_id,
        crate::updates::c2c_send_messages::SenderStatus::Blocked => return Blocked,
        crate::updates::c2c_send_messages::SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
            if !verify_user(local_user_index_canister_id, user_id, false).await {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| c2c_notify_user_canister_events_impl(args, caller_user_id, state))
}

fn c2c_notify_user_canister_events_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, caller_user_id, state);
    }
    Success
}

fn process_event(event: UserCanisterEvent, caller_user_id: UserId, state: &mut RuntimeState) {
    match event {
        UserCanisterEvent::SendMessages(args) => {
            send_messages(*args, caller_user_id, state);
        }
        UserCanisterEvent::EditMessage(args) => {
            edit_message(*args, caller_user_id, state);
        }
        UserCanisterEvent::DeleteMessages(args) => {
            delete_messages(*args, caller_user_id, state);
        }
        UserCanisterEvent::UndeleteMessages(args) => {
            undelete_messages(*args, caller_user_id, state);
        }
        UserCanisterEvent::ToggleReaction(args) => {
            toggle_reaction(*args, caller_user_id, state);
        }
        UserCanisterEvent::TipMessage(args) => {
            tip_message(*args, caller_user_id, state);
        }
        UserCanisterEvent::MarkMessagesRead(args) => {
            if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
                let now = state.env.now();
                chat.mark_read_up_to(args.read_up_to, false, now);
            }
        }
        UserCanisterEvent::P2PSwapStatusChange(c) => {
            if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
                chat.events.set_p2p_swap_status(None, c.message_id, c.status, state.env.now());
            }
        }
        UserCanisterEvent::JoinVideoCall(c) => {
            if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
                chat.events.set_video_call_presence(
                    caller_user_id,
                    c.message_id,
                    VideoCallPresence::Default,
                    EventIndex::default(),
                    state.env.now(),
                );
            }
        }
        UserCanisterEvent::StartVideoCall(args) => {
            handle_start_video_call(
                args.message_id,
                Some(args.message_index),
                state.env.canister_id().into(),
                caller_user_id,
                args.max_duration.unwrap_or(HOUR_IN_MS),
                state,
            );
        }
    }
}

fn send_messages(args: SendMessagesArgs, sender: UserId, state: &mut RuntimeState) {
    let now = state.env.now();
    for message in args.messages {
        // Messages sent c2c can be retried so the same messageId may be received multiple
        // times, so here we skip any messages whose messageId already exists.
        if let Some(chat) = state.data.direct_chats.get(&sender.into()) {
            if chat.events.contains_message_id(None, message.message_id) {
                continue;
            }
        }

        handle_message_impl(
            HandleMessageArgs {
                sender,
                thread_root_message_id: message.thread_root_message_id,
                message_id: Some(message.message_id),
                sender_message_index: Some(message.sender_message_index),
                sender_name: args.sender_name.clone(),
                sender_display_name: args.sender_display_name.clone(),
                content: message.content,
                replies_to: message.replies_to,
                forwarding: message.forwarding,
                is_bot: false,
                sender_avatar_id: args.sender_avatar_id,
                push_message_sent_event: false,
                mute_notification: message.message_filter_failed.is_some(),
                mentioned: Vec::new(),
                block_level_markdown: message.block_level_markdown,
                now,
            },
            state,
        );
    }
}

fn edit_message(args: user_canister::EditMessageArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let now = state.env.now();
        let thread_root_message_index = args.thread_root_message_id.map(|id| chat.main_message_id_to_index(id));

        chat.events.edit_message::<CdkRuntime>(
            EditMessageArgs {
                sender: caller_user_id,
                min_visible_event_index: EventIndex::default(),
                thread_root_message_index,
                message_id: args.message_id,
                content: args.content.into(),
                block_level_markdown: args.block_level_markdown,
                now,
            },
            None,
        );
    }
}

fn delete_messages(args: user_canister::DeleteUndeleteMessagesArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    let chat_id = caller_user_id.into();
    if let Some(chat) = state.data.direct_chats.get_mut(&chat_id) {
        let now = state.env.now();
        let thread_root_message_index = args.thread_root_message_id.map(|id| chat.main_message_id_to_index(id));

        let delete_message_results = chat.events.delete_messages(DeleteUndeleteMessagesArgs {
            caller: caller_user_id,
            is_admin: false,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index,
            message_ids: args.message_ids,
            now,
        });

        let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
        for (message_id, result) in delete_message_results {
            if matches!(result, DeleteMessageResult::Success(_)) {
                state.data.timer_jobs.enqueue_job(
                    TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
                        chat_id,
                        thread_root_message_index,
                        message_id,
                    })),
                    remove_deleted_message_content_at,
                    now,
                );
            }
        }
    }
}

fn undelete_messages(args: user_canister::DeleteUndeleteMessagesArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let thread_root_message_index = args.thread_root_message_id.map(|id| chat.main_message_id_to_index(id));

        chat.events.undelete_messages(DeleteUndeleteMessagesArgs {
            caller: caller_user_id,
            is_admin: false,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index,
            message_ids: args.message_ids,
            now: state.env.now(),
        });
    }
}

fn toggle_reaction(args: ToggleReactionArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    if !args.reaction.is_valid() {
        return;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let thread_root_message_index = args.thread_root_message_id.map(|id| chat.main_message_id_to_index(id));

        let add_remove_reaction_args = AddRemoveReactionArgs {
            user_id: caller_user_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index,
            message_id: args.message_id,
            reaction: args.reaction.clone(),
            now: state.env.now(),
        };

        if args.added {
            if matches!(
                chat.events.add_reaction::<CdkRuntime>(add_remove_reaction_args, None),
                AddRemoveReactionResult::Success
            ) && !state.data.suspended.value
            {
                if let Some((recipient, notification)) = build_notification(args, chat) {
                    state.push_notification(recipient, notification);
                }
            }
        } else {
            chat.events.remove_reaction(add_remove_reaction_args);
        }
    }
}

fn build_notification(
    ToggleReactionArgs {
        thread_root_message_id,
        message_id,
        reaction,
        username,
        display_name,
        user_avatar_id,
        ..
    }: ToggleReactionArgs,
    chat: &DirectChat,
) -> Option<(UserId, Notification)> {
    if username.is_empty() || chat.notifications_muted.value {
        return None;
    }

    let thread_root_message_index = thread_root_message_id.map(|id| chat.main_message_id_to_index(id));
    let message_event = chat
        .events
        .events_reader(EventIndex::default(), thread_root_message_index)
        .and_then(|reader| reader.message_event(message_id.into(), None))
        .filter(|m| m.event.sender != chat.them)?;

    Some((
        message_event.event.sender,
        Notification::DirectReactionAdded(DirectReactionAddedNotification {
            them: chat.them,
            thread_root_message_index,
            message_index: message_event.event.message_index,
            message_event_index: message_event.index,
            username,
            display_name,
            reaction,
            user_avatar_id,
        }),
    ))
}

fn tip_message(args: user_canister::TipMessageArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let now = state.env.now();
        let my_user_id = state.env.canister_id().into();
        let thread_root_message_index = args.thread_root_message_id.map(|id| chat.main_message_id_to_index(id));

        let tip_message_args = TipMessageArgs {
            user_id: caller_user_id,
            recipient: my_user_id,
            thread_root_message_index,
            message_id: args.message_id,
            ledger: args.ledger,
            token: args.token.clone(),
            amount: args.amount,
            now,
        };

        if matches!(
            chat.events
                .tip_message::<CdkRuntime>(tip_message_args, EventIndex::default(), None),
            TipMessageResult::Success
        ) {
            if let Some(event) = chat
                .events
                .main_events_reader()
                .message_event_internal(args.message_id.into())
            {
                let notification = Notification::DirectMessageTipped(DirectMessageTipped {
                    them: caller_user_id,
                    thread_root_message_index,
                    message_index: event.event.message_index,
                    message_event_index: event.index,
                    username: args.username,
                    display_name: args.display_name,
                    tip: format_crypto_amount_with_symbol(args.amount, args.decimals, args.token.token_symbol()),
                    user_avatar_id: args.user_avatar_id,
                });
                state.push_notification(my_user_id, notification);
            }
        }
    }
}
