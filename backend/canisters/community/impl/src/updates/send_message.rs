use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_video_call_operator;
use crate::model::members::CommunityMembers;
use crate::model::user_groups::UserGroup;
use crate::timer_job_types::{
    DeleteFileReferencesJob, EndPollJob, MarkP2PSwapExpiredJob, RefundPrizeJob, RemoveExpiredEventsJob, TimerJob,
};
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::{update_candid_and_msgpack, update_msgpack};
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use community_canister::c2c_send_message::{Args as C2CArgs, Response as C2CResponse};
use community_canister::send_message::{Response::*, *};
use event_sink_client::EventBuilder;
use group_chat_core::SendMessageResult;
use ic_cdk_macros::update;
use itertools::Itertools;
use lazy_static::lazy_static;
use regex_lite::Regex;
use std::str::FromStr;
use types::{
    ChannelId, ChannelMessageNotification, EventWrapper, Message, MessageContent, MessageContentInitial, MessageIndex,
    Notification, TimestampMillis, User, UserId, Version, VideoCallContentInitial,
};

#[update_candid_and_msgpack]
#[trace]
fn send_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, state))
}

#[update_msgpack]
#[trace]
fn c2c_send_message(args: C2CArgs) -> C2CResponse {
    run_regular_jobs();

    mutate_state(|state| c2c_send_message_impl(args, state))
}

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn start_video_call(args: community_canister::start_video_call::Args) -> community_canister::start_video_call::Response {
    run_regular_jobs();

    let send_message_args = Args {
        channel_id: args.channel_id,
        thread_root_message_index: None,
        message_id: args.message_id,
        content: MessageContentInitial::VideoCall(VideoCallContentInitial {
            initiator: args.initiator,
        }),
        sender_name: args.sender_name,
        sender_display_name: None,
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
        community_rules_accepted: None,
        channel_rules_accepted: None,
        message_filter_failed: None,
    };

    match mutate_state(|state| send_message_impl(send_message_args, state)) {
        Success(s) => community_canister::start_video_call::Response::Success(s),
        _ => community_canister::start_video_call::Response::NotAuthorized,
    }
}

fn send_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Caller {
        user_id,
        is_bot,
        is_video_call_operator,
        display_name,
    } = match validate_caller(args.community_rules_accepted, state) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        let users_mentioned = extract_users_mentioned(args.mentioned, args.content.text(), &state.data.members);

        let result = channel.chat.validate_and_send_message(
            user_id,
            is_bot,
            args.thread_root_message_index,
            args.message_id,
            args.content,
            args.replies_to,
            users_mentioned.all_users_mentioned,
            args.forwarding,
            args.channel_rules_accepted,
            args.message_filter_failed.is_some(),
            state.data.proposals_bot_user_id,
            is_video_call_operator,
            now,
        );

        process_send_message_result(
            result,
            user_id,
            args.sender_name,
            display_name.or(args.sender_display_name),
            channel.id,
            channel.chat.name.value.clone(),
            channel.chat.avatar.as_ref().map(|d| d.id),
            args.thread_root_message_index,
            users_mentioned.mentioned_directly,
            users_mentioned.user_groups_mentioned,
            now,
            state,
        )
    } else {
        ChannelNotFound
    }
}

fn c2c_send_message_impl(args: C2CArgs, state: &mut RuntimeState) -> C2CResponse {
    let Caller {
        user_id,
        is_bot,
        is_video_call_operator: _,
        display_name,
    } = match validate_caller(args.community_rules_accepted, state) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // Bots can't call this c2c endpoint since it skips the validation
    if is_bot && user_id != state.data.proposals_bot_user_id {
        return NotAuthorized;
    }

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        let users_mentioned = extract_users_mentioned(args.mentioned, args.content.text(), &state.data.members);

        let result = channel.chat.send_message(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.content,
            args.replies_to,
            users_mentioned.all_users_mentioned,
            args.forwarding,
            args.channel_rules_accepted,
            args.message_filter_failed.is_some(),
            state.data.proposals_bot_user_id,
            now,
        );

        process_send_message_result(
            result,
            user_id,
            args.sender_name,
            display_name.or(args.sender_display_name),
            channel.id,
            channel.chat.name.value.clone(),
            channel.chat.avatar.as_ref().map(|d| d.id),
            args.thread_root_message_index,
            users_mentioned.mentioned_directly,
            users_mentioned.user_groups_mentioned,
            now,
            state,
        )
    } else {
        ChannelNotFound
    }
}

struct Caller {
    user_id: UserId,
    is_bot: bool,
    is_video_call_operator: bool,
    display_name: Option<String>,
}

fn validate_caller(community_rules_accepted: Option<Version>, state: &mut RuntimeState) -> Result<Caller, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();
    if state.is_caller_video_call_operator() {
        Ok(Caller {
            user_id: caller.into(),
            is_bot: true,
            is_video_call_operator: true,
            display_name: None,
        })
    } else if let Some(member) = state.data.members.get_mut(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else {
            if let Some(version) = community_rules_accepted {
                member.accept_rules(version, state.env.now());
            }
            if state.data.rules.enabled
                && !member.is_bot
                && member
                    .rules_accepted
                    .as_ref()
                    .map_or(true, |accepted| accepted.value < state.data.rules.text.version)
            {
                return Err(CommunityRulesNotAccepted);
            }

            Ok(Caller {
                user_id: member.user_id,
                is_bot: member.is_bot,
                is_video_call_operator: false,
                display_name: member.display_name().value.clone(),
            })
        }
    } else {
        Err(UserNotInCommunity)
    }
}

#[allow(clippy::too_many_arguments)]
fn process_send_message_result(
    result: SendMessageResult,
    sender: UserId,
    sender_username: String,
    sender_display_name: Option<String>,
    channel_id: ChannelId,
    channel_name: String,
    channel_avatar_id: Option<u128>,
    thread_root_message_index: Option<MessageIndex>,
    mentioned: Vec<User>,
    user_groups_mentioned: Vec<(u32, String)>,
    now: TimestampMillis,
    state: &mut RuntimeState,
) -> Response {
    match result {
        SendMessageResult::Success(result) => {
            let event_index = result.message_event.index;
            let message_index = result.message_event.event.message_index;
            let expires_at = result.message_event.expires_at;

            let mut is_next_event_to_expire = false;
            if let Some(expiry) = expires_at {
                is_next_event_to_expire = state.data.next_event_expiry.map_or(true, |ex| expiry < ex);
                if is_next_event_to_expire {
                    state.data.next_event_expiry = expires_at;
                }
            }

            register_timer_jobs(
                channel_id,
                thread_root_message_index,
                &result.message_event,
                is_next_event_to_expire,
                now,
                &mut state.data.timer_jobs,
            );

            // Exclude suspended members from notification
            let users_to_notify: Vec<UserId> = result
                .users_to_notify
                .into_iter()
                .filter(|u| state.data.members.get_by_user_id(u).map_or(false, |m| !m.suspended.value))
                .collect();

            let content = &result.message_event.event.content;
            let this_canister_id = state.env.canister_id();
            let notification = Notification::ChannelMessage(ChannelMessageNotification {
                community_id: this_canister_id.into(),
                channel_id,
                thread_root_message_index,
                message_index: result.message_event.event.message_index,
                event_index: result.message_event.index,
                community_name: state.data.name.clone(),
                channel_name,
                sender,
                sender_name: sender_username,
                sender_display_name,
                message_type: content.message_type(),
                message_text: content.notification_text(&mentioned, &user_groups_mentioned),
                image_url: content.notification_image_url(),
                community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
                channel_avatar_id,
                crypto_transfer: content.notification_crypto_transfer_details(&mentioned),
            });
            state.push_notification(users_to_notify, notification);

            handle_activity_notification(state);

            state.data.event_sink_client.push(
                EventBuilder::new("message_sent", now)
                    .with_user(sender.to_string())
                    .with_source(this_canister_id.to_string())
                    .with_json_payload(&result.event_payload)
                    .build(),
            );

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
        SendMessageResult::RulesNotAccepted => RulesNotAccepted,
        SendMessageResult::InvalidRequest(error) => InvalidRequest(error),
    }
}

fn register_timer_jobs(
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    is_next_event_to_expire: bool,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    let files = message_event.event.content.blob_references();
    if !files.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            timer_jobs.enqueue_job(TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files }), expiry, now);
        }
    }

    if let Some(expiry) = message_event.expires_at.filter(|_| is_next_event_to_expire) {
        timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
        timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
    }

    match &message_event.event.content {
        MessageContent::Poll(p) => {
            if let Some(end_date) = p.config.end_date {
                timer_jobs.enqueue_job(
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
            timer_jobs.enqueue_job(
                TimerJob::RefundPrize(RefundPrizeJob {
                    channel_id,
                    thread_root_message_index,
                    message_index: message_event.event.message_index,
                }),
                p.end_date,
                now,
            );
        }
        MessageContent::P2PSwap(c) => {
            timer_jobs.enqueue_job(
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
