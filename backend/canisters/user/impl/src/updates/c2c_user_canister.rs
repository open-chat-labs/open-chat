use crate::timer_job_types::{HardDeleteMessageContentJob, TimerJob};
use crate::updates::c2c_send_messages::{get_sender_status, handle_message_impl, verify_user, HandleMessageArgs};
use crate::updates::start_video_call::handle_start_video_call;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{
    AddRemoveReactionArgs, AddRemoveReactionResult, DeleteMessageResult, DeleteUndeleteMessagesArgs, EditMessageArgs,
    MessageContentInternal, Reader, TipMessageArgs, TipMessageResult,
};
use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use event_store_producer_cdk_runtime::CdkRuntime;
use ledger_utils::format_crypto_amount_with_symbol;
use types::{
    Achievement, Chat, ChitEarned, ChitEarnedReason, DirectMessageTipped, DirectReactionAddedNotification, EventIndex,
    MessageContentInitial, Notification, P2PSwapStatus, UserId, UserType, VideoCallPresence,
};
use user_canister::c2c_user_canister::{Response::*, *};
use user_canister::{
    MessageActivity, MessageActivityEvent, P2PSwapStatusChange, SendMessagesArgs, ToggleReactionArgs, UserCanisterEvent,
};

#[update(msgpack = true)]
#[trace]
async fn c2c_user_canister(args: Args) -> Response {
    run_regular_jobs();

    let caller_user_id = match read_state(get_sender_status) {
        crate::updates::c2c_send_messages::SenderStatus::Ok(user_id, UserType::User) => user_id,
        crate::updates::c2c_send_messages::SenderStatus::Ok(..) => panic!("This request is from an OpenChat bot user"),
        crate::updates::c2c_send_messages::SenderStatus::Blocked => return Blocked,
        crate::updates::c2c_send_messages::SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
            if !matches!(verify_user(local_user_index_canister_id, user_id).await, Some(UserType::User)) {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| c2c_notify_user_canister_events_impl(args, caller_user_id, state))
}

fn c2c_notify_user_canister_events_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    let caller = caller_user_id.into();
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            process_event(event.value, caller_user_id, state);
        }
    }
    Success
}

fn process_event(event: UserCanisterEvent, caller_user_id: UserId, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        UserCanisterEvent::SendMessages(args) => {
            let mut awarded = state.data.award_achievement(Achievement::ReceivedDirectMessage, now);

            if args
                .messages
                .iter()
                .any(|m| matches!(m.content, MessageContentInternal::Crypto(_)))
            {
                awarded |= state.data.award_achievement(Achievement::ReceivedCrypto, now);
            }

            if awarded {
                state.notify_user_index_of_chit(now);
            }

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
                chat.mark_read_up_to(args.read_up_to, false, now);
            }
        }
        UserCanisterEvent::P2PSwapStatusChange(c) => {
            p2p_swap_change_status(*c, caller_user_id, state);
        }
        UserCanisterEvent::JoinVideoCall(c) => {
            if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
                chat.events.set_video_call_presence(
                    caller_user_id,
                    c.message_id,
                    VideoCallPresence::Default,
                    EventIndex::default(),
                    now,
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
        UserCanisterEvent::SetReferralStatus(status) => {
            let chit_reward = state.data.referrals.set_status(caller_user_id, *status, now);
            let mut rewarded = false;

            if chit_reward > 0 {
                state.data.chit_events.push(ChitEarned {
                    amount: chit_reward as i32,
                    timestamp: now,
                    reason: ChitEarnedReason::Referral(*status),
                });

                rewarded = true;
            }

            if let Some(achievement) = match state.data.referrals.total_verified() {
                1 => Some(Achievement::Referred1stUser),
                3 => Some(Achievement::Referred3rdUser),
                10 => Some(Achievement::Referred10thUser),
                20 => Some(Achievement::Referred20thUser),
                50 => Some(Achievement::Referred50thUser),
                _ => None,
            } {
                rewarded |= state.data.award_achievement(achievement, now);
            }

            if rewarded {
                state.notify_user_index_of_chit(now);
            }
        }
    }
}

fn send_messages(args: SendMessagesArgs, sender: UserId, state: &mut RuntimeState) {
    let now = state.env.now();
    for message in args.messages {
        // Messages sent c2c can be retried so the same messageId may be received multiple
        // times, so here we skip any messages whose messageId already exists.
        if let Some(chat) = state.data.direct_chats.get(&sender.into()) {
            let thread_root_message_index = message.thread_root_message_id.map(|id| chat.main_message_id_to_index(id));

            if chat
                .events
                .message_already_finalised(thread_root_message_index, message.message_id, false)
            {
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
                sender_user_type: UserType::User,
                sender_avatar_id: args.sender_avatar_id,
                push_message_sent_event: false,
                mute_notification: message.message_filter_failed.is_some(),
                mentioned: Vec::new(),
                block_level_markdown: message.block_level_markdown,
                now,
            },
            None,
            false,
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
                content: MessageContentInitial::from(args.content).into(),
                block_level_markdown: args.block_level_markdown,
                finalise_bot_message: false,
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

        let now = state.env.now();

        let add_remove_reaction_args = AddRemoveReactionArgs {
            user_id: caller_user_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index,
            message_id: args.message_id,
            reaction: args.reaction.clone(),
            now,
        };

        if args.added {
            if matches!(
                chat.events.add_reaction::<CdkRuntime>(add_remove_reaction_args, None),
                AddRemoveReactionResult::Success(_)
            ) {
                if let Some(message_event) = chat
                    .events
                    .main_events_reader()
                    .message_event_internal(args.message_id.into())
                {
                    if !state.data.suspended.value && !args.username.is_empty() && !chat.notifications_muted.value {
                        let notification = Notification::DirectReactionAdded(DirectReactionAddedNotification {
                            them: chat.them,
                            thread_root_message_index,
                            message_index: message_event.event.message_index,
                            message_event_index: message_event.index,
                            username: args.username,
                            display_name: args.display_name,
                            reaction: args.reaction,
                            user_avatar_id: args.user_avatar_id,
                        });

                        state.push_notification(Some(caller_user_id), message_event.event.sender, notification);
                    }

                    state.data.push_message_activity(
                        MessageActivityEvent {
                            chat: Chat::Direct(caller_user_id.into()),
                            thread_root_message_index,
                            message_index: message_event.event.message_index,
                            message_id: message_event.event.message_id,
                            event_index: message_event.index,
                            activity: MessageActivity::Reaction,
                            timestamp: now,
                            user_id: Some(caller_user_id),
                        },
                        now,
                    );
                }

                state.award_achievement_and_notify(Achievement::HadMessageReactedTo, now);
            }
        } else {
            chat.events.remove_reaction(add_remove_reaction_args);
        }
    }
}

fn p2p_swap_change_status(args: P2PSwapStatusChange, caller_user_id: UserId, state: &mut RuntimeState) {
    let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) else {
        return;
    };

    let now = state.env.now();
    let completed = matches!(args.status, P2PSwapStatus::Completed(_));

    chat.events.set_p2p_swap_status(None, args.message_id, args.status, now);

    if completed {
        if let Some(message_event) = chat
            .events
            .main_events_reader()
            .message_event_internal(args.message_id.into())
        {
            let thread_root_message_index = args.thread_root_message_id.map(|id| chat.main_message_id_to_index(id));

            state.data.push_message_activity(
                MessageActivityEvent {
                    chat: Chat::Direct(caller_user_id.into()),
                    thread_root_message_index,
                    message_index: message_event.event.message_index,
                    message_id: message_event.event.message_id,
                    event_index: message_event.index,
                    activity: MessageActivity::P2PSwapAccepted,
                    timestamp: now,
                    user_id: Some(caller_user_id),
                },
                now,
            );
        }
    }
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
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            now,
        };

        if matches!(
            chat.events
                .tip_message::<CdkRuntime>(tip_message_args, EventIndex::default(), None),
            TipMessageResult::Success
        ) {
            if let Some(message_event) = chat
                .events
                .main_events_reader()
                .message_event_internal(args.message_id.into())
            {
                let notification = Notification::DirectMessageTipped(DirectMessageTipped {
                    them: caller_user_id,
                    thread_root_message_index,
                    message_index: message_event.event.message_index,
                    message_event_index: message_event.index,
                    username: args.username,
                    display_name: args.display_name,
                    tip: format_crypto_amount_with_symbol(args.amount, args.decimals, &args.token_symbol),
                    user_avatar_id: args.user_avatar_id,
                });
                state.push_notification(Some(caller_user_id), my_user_id, notification);

                state.data.push_message_activity(
                    MessageActivityEvent {
                        chat: Chat::Direct(caller_user_id.into()),
                        thread_root_message_index,
                        message_index: message_event.event.message_index,
                        message_id: message_event.event.message_id,
                        event_index: message_event.index,
                        activity: MessageActivity::Tip,
                        timestamp: now,
                        user_id: Some(caller_user_id),
                    },
                    now,
                );
            }

            state.award_achievement_and_notify(Achievement::HadMessageTipped, now);
        }
    }
}
