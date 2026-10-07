use crate::timer_job_types::{HardDeleteMessageContentJob, TimerJob};
use crate::updates::send_message::receive_message;
use crate::updates::start_video_call::handle_start_video_call;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use rand::RngExt;
use types::{Achievement, CallKind, CanisterId, UserId, UserType};
use user_canister::c2c_user_canister::{Response::*, *};
use user_canister::{P2PSwapStatusChange, SendMessagesArgs, ToggleReactionArgs, UserCanisterEvent};
use user_core::updates::c2c_user_canister::ReceiveMessageArgs;

#[update(msgpack = true)]
#[trace]
async fn c2c_user_canister(args: Args) -> Response {
    execute_update_async(|| c2c_user_canister_impl(args)).await
}

async fn c2c_user_canister_impl(args: Args) -> Response {
    let caller_user_id = match read_state(get_sender_status) {
        SenderStatus::Ok(user_id, UserType::User) => user_id,
        SenderStatus::Ok(..) => panic!("This request is from an OpenChat bot user"),
        SenderStatus::Blocked => return Blocked,
        SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
            if !matches!(verify_user(local_user_index_canister_id, user_id).await, Some(UserType::User)) {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| c2c_notify_user_canister_events_impl(args, caller_user_id, state))
}

enum SenderStatus {
    Ok(UserId, UserType),
    Blocked,
    UnknownUser(CanisterId, UserId),
}

fn get_sender_status(state: &RuntimeState) -> SenderStatus {
    let sender: UserId = state.env.caller().into();
    if state.data.user.blocked_users.contains(&sender) {
        SenderStatus::Blocked
    } else if let Some(user_type) = state.data.user.direct_chats.user_type(&sender.into()) {
        SenderStatus::Ok(sender, user_type)
    } else {
        SenderStatus::UnknownUser(state.data.local_user_index_canister_id, sender)
    }
}

async fn verify_user(local_user_index_canister_id: CanisterId, user_id: UserId) -> Option<UserType> {
    let args = local_user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: user_id.as_principal(),
    };
    if let Ok(response) = local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &args).await {
        if let local_user_index_canister::c2c_lookup_user::Response::Success(r) = response {
            Some(r.user_type)
        } else {
            None
        }
    } else {
        panic!("Failed to call local_user_index to verify user");
    }
}

fn c2c_notify_user_canister_events_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    let caller = caller_user_id.as_principal();
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

pub(crate) fn process_event(event: UserCanisterEvent, caller_user_id: UserId, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        UserCanisterEvent::SendMessages(args) => {
            let mut awarded = state.data.user.award_achievement(Achievement::ReceivedDirectMessage, now);

            if args
                .messages
                .iter()
                .any(|m| matches!(m.content, MessageContentInternal::Crypto(_)))
            {
                awarded |= state.data.user.award_achievement(Achievement::ReceivedCrypto, now);
            }

            if awarded {
                state.notify_user_index_of_chit(now);
            }

            send_messages(*args, caller_user_id, state);
        }
        UserCanisterEvent::EditMessage(args) => {
            if let Some(mut chat) = state.data.user.direct_chats.get_mut(&caller_user_id.into()) {
                user_core::updates::c2c_user_canister::edit_message(
                    &mut chat,
                    caller_user_id,
                    *args,
                    now,
                    &state.data.migrated_user_ids,
                );
            }
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
            if let Some(mut chat) = state.data.user.direct_chats.get_mut(&caller_user_id.into()) {
                chat.mark_read_by_them_up_to(args.read_up_to, now);
            }
        }
        UserCanisterEvent::P2PSwapStatusChange(c) => {
            p2p_swap_change_status(*c, caller_user_id, state);
        }
        UserCanisterEvent::JoinVideoCall(c) => {
            if let Some(mut chat) = state.data.user.direct_chats.get_mut(&caller_user_id.into()) {
                user_core::updates::c2c_user_canister::join_video_call(&mut chat, caller_user_id, c.message_id, now);
            }
        }
        UserCanisterEvent::StartVideoCall(args) => {
            handle_start_video_call(
                args.message_id,
                Some(args.message_index),
                state.env.canister_id().into(),
                caller_user_id,
                if args.audio_only { CallKind::Audio } else { CallKind::Video },
                args.max_duration.unwrap_or(HOUR_IN_MS),
                state,
            );
        }
        UserCanisterEvent::SetReferralStatus(status) => {
            if state.data.user.set_referral_status(caller_user_id, &[], *status, now) {
                state.notify_user_index_of_chit(now);
            }
        }
        UserCanisterEvent::SetReferralStatusV2(args) => {
            if state
                .data
                .user
                .set_referral_status(caller_user_id, &args.previous_user_ids, args.status, now)
            {
                state.notify_user_index_of_chit(now);
            }
        }
        UserCanisterEvent::SetEventsTtl(args) => {
            let my_user_id = state.env.canister_id().into();
            user_core::updates::c2c_user_canister::set_events_ttl(
                &mut state.data.user,
                my_user_id,
                caller_user_id,
                *args,
                || state.env.rng().random(),
                now,
            );
        }
    }
}

fn send_messages(args: SendMessagesArgs, sender: UserId, state: &mut RuntimeState) {
    for message in args.messages {
        receive_message(
            ReceiveMessageArgs {
                sender,
                sender_user_type: UserType::User,
                sender_name: args.sender_name.clone(),
                sender_display_name: args.sender_display_name.clone(),
                sender_avatar_id: args.sender_avatar_id,
                thread_root_message_id: message.thread_root_message_id,
                message_id: message.message_id,
                sender_message_index: Some(message.sender_message_index),
                content: message.content,
                replies_to: message.replies_to,
                forwarding: message.forwarding,
                block_level_markdown: message.block_level_markdown,
                og_previews: message.og_previews,
                mentioned: Vec::new(),
                mute_notification: message.message_filter_failed.is_some(),
            },
            false,
            state,
        );
    }
}

fn delete_messages(args: user_canister::DeleteUndeleteMessagesArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    let chat_id = caller_user_id.into();
    let now = state.env.now();
    let Some((thread_root_message_index, deleted)) = state.data.user.direct_chats.get_mut(&chat_id).and_then(|mut chat| {
        user_core::updates::c2c_user_canister::delete_messages(
            &mut chat,
            caller_user_id,
            args,
            now,
            &state.data.migrated_user_ids,
        )
    }) else {
        return;
    };

    let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
    for message_id in deleted {
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

fn undelete_messages(args: user_canister::DeleteUndeleteMessagesArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    let chat_id = caller_user_id.into();
    let now = state.env.now();
    let Some((thread_root_message_index, undeleted)) = state.data.user.direct_chats.get_mut(&chat_id).and_then(|mut chat| {
        user_core::updates::c2c_user_canister::undelete_messages(
            &mut chat,
            caller_user_id,
            args,
            now,
            &state.data.migrated_user_ids,
        )
    }) else {
        return;
    };

    HardDeleteMessageContentJob::cancel(&mut state.data.timer_jobs, chat_id, thread_root_message_index, &undeleted);
}

fn toggle_reaction(args: ToggleReactionArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    let now = state.env.now();
    let Some(reaction) = state
        .data
        .user
        .direct_chats
        .get_mut(&caller_user_id.into())
        .and_then(|mut chat| {
            user_core::updates::c2c_user_canister::toggle_reaction(
                &mut chat,
                caller_user_id,
                args,
                now,
                &state.data.migrated_user_ids,
            )
        })
    else {
        return;
    };

    if let Some(notification) = reaction.notification
        && !state.data.user.suspended.value
    {
        // The reacted-to message wasn't the sender's, so it is this user's
        let my_user_id = state.env.canister_id().into();
        state.push_notification(Some(caller_user_id), my_user_id, notification);
    }
    state.data.user.push_message_activity(reaction.activity, now);
    state.award_achievement_and_notify(Achievement::HadMessageReactedTo, now);
}

fn p2p_swap_change_status(args: P2PSwapStatusChange, caller_user_id: UserId, state: &mut RuntimeState) {
    let now = state.env.now();
    user_core::updates::c2c_user_canister::p2p_swap_change_status(&mut state.data.user, caller_user_id, args, now);
}

fn tip_message(args: user_canister::TipMessageArgs, caller_user_id: UserId, state: &mut RuntimeState) {
    let now = state.env.now();
    let my_user_id = state.env.canister_id().into();
    let Some(received) = state
        .data
        .user
        .direct_chats
        .get_mut(&caller_user_id.into())
        .and_then(|mut chat| {
            user_core::updates::c2c_user_canister::tip_message(
                &mut chat,
                caller_user_id,
                my_user_id,
                args,
                now,
                &state.data.migrated_user_ids,
            )
        })
    else {
        return;
    };

    if let Some(notification) = received.notification {
        state.push_notification(Some(caller_user_id), my_user_id, notification);
    }
    if let Some(activity) = received.activity {
        state.data.user.push_message_activity(activity, now);
    }
    state.award_achievement_and_notify(Achievement::HadMessageTipped, now);
}
