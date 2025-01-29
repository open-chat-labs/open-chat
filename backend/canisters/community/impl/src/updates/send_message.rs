use crate::activity_notifications::handle_activity_notification;
use crate::model::members::CommunityMembers;
use crate::model::user_groups::UserGroup;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob, FinalPrizePaymentsJob, MarkP2PSwapExpiredJob, TimerJob};
use crate::{mutate_state, run_regular_jobs, CallerResult, Data, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use community_canister::send_message::{Response::*, *};
use group_chat_core::SendMessageResult;
use itertools::Itertools;
use lazy_static::lazy_static;
use regex_lite::Regex;
use std::str::FromStr;
use types::{
    Achievement, BotCaller, Caller, ChannelId, ChannelMessageNotification, Chat, EventIndex, EventWrapper, Message,
    MessageContent, MessageIndex, Notification, TimestampMillis, User, UserId, Version,
};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
fn send_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, None, state))
}

#[update(msgpack = true)]
#[trace]
fn c2c_send_message(args: C2CArgs) -> C2CResponse {
    run_regular_jobs();

    mutate_state(|state| c2c_send_message_impl(args, state))
}

pub(crate) fn send_message_impl(args: Args, bot: Option<BotCaller>, state: &mut RuntimeState) -> Response {
    let caller = match state.verified_caller(bot) {
        CallerResult::Success(caller) => caller,
        CallerResult::NotFound => return UserNotInCommunity,
        CallerResult::Suspended => return UserSuspended,
        CallerResult::Lapsed => return UserLapsed,
    };

    let display_name = match prepare(&caller, args.community_rules_accepted, state) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        let users_mentioned = extract_users_mentioned(args.mentioned, args.content.text(), &state.data.members);

        let result = channel.chat.validate_and_send_message(
            &caller,
            args.thread_root_message_index,
            args.message_id,
            args.content,
            args.replies_to,
            &users_mentioned.all_users_mentioned,
            args.forwarding,
            args.channel_rules_accepted,
            args.message_filter_failed.is_some(),
            args.block_level_markdown,
            &mut state.data.event_store_client,
            now,
        );

        process_send_message_result(
            result,
            &caller,
            args.sender_name,
            display_name.or(args.sender_display_name),
            channel.id,
            channel.chat.name.value.clone(),
            channel.chat.avatar.as_ref().map(|d| d.id),
            args.thread_root_message_index,
            users_mentioned,
            args.new_achievement,
            now,
            state,
        )
    } else {
        ChannelNotFound
    }
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> C2CResponse {
    let caller = match state.verified_caller(None) {
        CallerResult::Success(caller) => caller,
        CallerResult::NotFound => return UserNotInCommunity,
        CallerResult::Suspended => return UserSuspended,
        CallerResult::Lapsed => return UserLapsed,
    };

    let display_name = match prepare(&caller, args.community_rules_accepted, state) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // Bots can't call this c2c endpoint since it skips the validation
    if matches!(caller, Caller::Bot(_) | Caller::BotCommand(_)) {
        return NotAuthorized;
    }

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        let users_mentioned = extract_users_mentioned(args.mentioned, args.content.text(), &state.data.members);

        let result = channel.chat.send_message(
            &caller,
            args.thread_root_message_index,
            args.message_id,
            args.content,
            args.replies_to,
            &users_mentioned.all_users_mentioned,
            args.forwarding,
            args.channel_rules_accepted,
            args.message_filter_failed.is_some(),
            args.block_level_markdown,
            &mut state.data.event_store_client,
            now,
        );

        process_send_message_result(
            result,
            &caller,
            args.sender_name,
            display_name.or(args.sender_display_name),
            channel.id,
            channel.chat.name.value.clone(),
            channel.chat.avatar.as_ref().map(|d| d.id),
            args.thread_root_message_index,
            users_mentioned,
            false,
            now,
            state,
        )
    } else {
        ChannelNotFound
    }
}

fn prepare(
    caller: &Caller,
    community_rules_accepted: Option<Version>,
    state: &mut RuntimeState,
) -> Result<Option<String>, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let now = state.env.now();

    if let Some(version) = community_rules_accepted {
        state.data.members.mark_rules_accepted(&caller.agent(), version, now);
    }

    if caller.is_bot() {
        return Ok(None);
    }

    if let Some(member) = state.data.members.get_by_user_id(&caller.agent()) {
        if state.data.rules.enabled
            && !member.user_type.is_bot()
            && member
                .rules_accepted
                .as_ref()
                .map_or(true, |accepted| accepted.value < state.data.rules.text.version)
        {
            Err(CommunityRulesNotAccepted)
        } else {
            Ok(member.display_name().value.clone())
        }
    } else {
        Err(UserNotInCommunity)
    }
}

#[allow(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageResult,
    caller: &Caller,
    sender_username: String,
    sender_display_name: Option<String>,
    channel_id: ChannelId,
    channel_name: String,
    channel_avatar_id: Option<u128>,
    thread_root_message_index: Option<MessageIndex>,
    users_mentioned: UsersMentioned,
    new_achievement: bool,
    now: TimestampMillis,
    state: &mut RuntimeState,
) -> Response {
    match result {
        SendMessageResult::Success(result) => {
            let message_event = &result.message_event;
            let event_index = message_event.index;
            let message_index = message_event.event.message_index;
            let message_id = message_event.event.message_id;
            let expires_at = message_event.expires_at;
            let content = &message_event.event.content;
            let community_id = state.env.canister_id().into();

            register_timer_jobs(channel_id, thread_root_message_index, message_event, now, &mut state.data);

            if !result.unfinalised_bot_message {
                let notification = Notification::ChannelMessage(ChannelMessageNotification {
                    community_id,
                    channel_id,
                    thread_root_message_index,
                    message_index: message_event.event.message_index,
                    event_index: message_event.index,
                    community_name: state.data.name.value.clone(),
                    channel_name,
                    sender: caller.agent(),
                    sender_name: sender_username,
                    sender_display_name,
                    message_type: content.message_type(),
                    message_text: content
                        .notification_text(&users_mentioned.mentioned_directly, &users_mentioned.user_groups_mentioned),
                    image_url: content.notification_image_url(),
                    community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
                    channel_avatar_id,
                    crypto_transfer: content.notification_crypto_transfer_details(&users_mentioned.mentioned_directly),
                });
                state.push_notification(result.users_to_notify, notification);

                if new_achievement && !caller.is_bot() {
                    for a in result
                        .message_event
                        .event
                        .achievements(false, thread_root_message_index.is_some())
                    {
                        state.data.notify_user_of_achievement(caller.agent(), a);
                    }
                }

                let mut activity_events = Vec::new();

                if let MessageContent::Crypto(c) = &message_event.event.content {
                    let recipient_is_human = state
                        .data
                        .members
                        .get_by_user_id(&c.recipient)
                        .is_some_and(|m| !m.user_type.is_bot());

                    if recipient_is_human {
                        state
                            .data
                            .notify_user_of_achievement(c.recipient, Achievement::ReceivedCrypto);

                        activity_events.push((c.recipient, MessageActivity::Crypto));
                    }
                }

                if let Some(channel) = state.data.channels.get(&channel_id) {
                    for user_id in users_mentioned.all_users_mentioned {
                        if caller.initiator().map(|i| i != user_id).unwrap_or_default()
                            && channel.chat.members.get(&user_id).is_some_and(|m| !m.user_type().is_bot())
                        {
                            activity_events.push((user_id, MessageActivity::Mention));
                        }
                    }

                    if let Some(replying_to_event_index) = message_event
                        .event
                        .replies_to
                        .as_ref()
                        .filter(|r| r.chat_if_other.is_none())
                        .map(|r| r.event_index)
                    {
                        if let Some((message, _)) = channel.chat.events.message_internal(
                            EventIndex::default(),
                            thread_root_message_index,
                            replying_to_event_index.into(),
                        ) {
                            if caller.initiator().map(|i| i != message.sender).unwrap_or_default()
                                && channel
                                    .chat
                                    .members
                                    .get(&message.sender)
                                    .is_some_and(|m| !m.user_type().is_bot())
                            {
                                activity_events.push((message.sender, MessageActivity::QuoteReply));
                            }
                        }
                    }
                }

                for (user_id, activity) in activity_events {
                    state.data.user_event_sync_queue.push(
                        user_id,
                        CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                            chat: Chat::Channel(community_id, channel_id),
                            thread_root_message_index,
                            message_index,
                            message_id,
                            event_index,
                            activity,
                            timestamp: now,
                            user_id: Some(caller.agent()),
                        }),
                    );
                }
            }

            handle_activity_notification(state);

            Success(SuccessResult {
                event_index,
                message_index,
                timestamp: now,
                expires_at,
            })
        }
        SendMessageResult::ThreadMessageNotFound => ThreadMessageNotFound,
        SendMessageResult::MessageEmpty => MessageEmpty,
        SendMessageResult::TextTooLong(max_length) => TextTooLong(max_length),
        SendMessageResult::InvalidPoll(reason) => InvalidPoll(reason),
        SendMessageResult::NotAuthorized => NotAuthorized,
        SendMessageResult::UserNotInGroup => UserNotInChannel,
        SendMessageResult::UserSuspended => UserSuspended,
        SendMessageResult::UserLapsed => UserLapsed,
        SendMessageResult::RulesNotAccepted => RulesNotAccepted,
        SendMessageResult::MessageAlreadyExists => MessageAlreadyExists,
        SendMessageResult::InvalidRequest(error) => InvalidRequest(error),
    }
}

fn register_timer_jobs(
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    now: TimestampMillis,
    data: &mut Data,
) {
    let files = message_event.event.content.blob_references();
    if !files.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            data.timer_jobs
                .enqueue_job(TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files }), expiry, now);
        }
    }

    if let Some(expiry) = message_event.expires_at {
        data.handle_event_expiry(expiry, now);
    }

    match &message_event.event.content {
        MessageContent::Poll(p) => {
            if let Some(end_date) = p.config.end_date {
                data.timer_jobs.enqueue_job(
                    TimerJob::EndPoll(EndPollJob {
                        channel_id,
                        thread_root_message_index,
                        message_index: message_event.event.message_index,
                    }),
                    end_date,
                    now,
                );
            }
        }
        MessageContent::Prize(p) => {
            data.timer_jobs.enqueue_job(
                TimerJob::FinalPrizePayments(FinalPrizePaymentsJob {
                    channel_id,
                    message_index: message_event.event.message_index,
                }),
                p.end_date,
                now,
            );
        }
        MessageContent::P2PSwap(c) => {
            data.timer_jobs.enqueue_job(
                TimerJob::MarkP2PSwapExpired(MarkP2PSwapExpiredJob {
                    channel_id,
                    thread_root_message_index,
                    message_id: message_event.event.message_id,
                }),
                c.expires_at,
                now,
            );
        }
        _ => {}
    }
}

lazy_static! {
    static ref USER_GROUP_REGEX: Regex = Regex::new(r"@UserGroup\((\d+)\)").unwrap();
}

struct UsersMentioned {
    mentioned_directly: Vec<User>,
    all_users_mentioned: Vec<UserId>,
    user_groups_mentioned: Vec<(u32, String)>,
}

fn extract_users_mentioned(mentioned: Vec<User>, text: Option<&str>, members: &CommunityMembers) -> UsersMentioned {
    let user_groups_mentioned = extract_user_groups_mentioned(text, members);
    let all_users_mentioned = mentioned
        .iter()
        .map(|u| u.user_id)
        .chain(user_groups_mentioned.iter().flat_map(|ug| ug.members.value.iter().copied()))
        .unique()
        .collect();

    UsersMentioned {
        mentioned_directly: mentioned,
        all_users_mentioned,
        user_groups_mentioned: user_groups_mentioned
            .iter()
            .map(|ug| (ug.id, ug.name.value.clone()))
            .collect(),
    }
}

fn extract_user_groups_mentioned<'a>(text: Option<&'a str>, members: &'a CommunityMembers) -> Vec<&'a UserGroup> {
    if let Some(text) = text {
        if text.contains("@UserGroup") {
            return USER_GROUP_REGEX
                .captures_iter(text)
                .filter_map(|c| c.get(1))
                .filter_map(|m| u32::from_str(m.as_str()).ok())
                .filter_map(|id| members.get_user_group(id))
                .collect();
        }
    }

    Vec::new()
}
