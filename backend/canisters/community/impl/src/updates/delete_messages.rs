use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, read_state, RuntimeState, TimerJob};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::DeleteMessageResult;
use community_canister::delete_messages::{Response::*, *};
use group_chat_core::DeleteMessagesResult;
use ic_cdk_macros::update;
use types::{CanisterId, UserId};
use user_index_canister_c2c_client::lookup_user;
use utils::time::MINUTE_IN_MS;

#[update]
#[trace]
async fn delete_messages(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_id,
        user_index_canister_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if args.as_platform_moderator.unwrap_or_default() {
        match lookup_user(caller, user_index_canister_id).await {
            Ok(u) if u.is_platform_moderator => {}
            Ok(_) => return NotPlatformModerator,
            Err(error) => return InternalError(format!("{error:?}")),
        }
    }

    mutate_state(|state| delete_messages_impl(user_id, args, state))
}

struct PrepareResult {
    caller: Principal,
    user_id: UserId,
    user_index_canister_id: CanisterId,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else {
            Ok(PrepareResult {
                caller,
                user_id: member.user_id,
                user_index_canister_id: state.data.user_index_canister_id,
            })
        }
    } else {
        Err(UserNotInCommunity)
    }
}

fn delete_messages_impl(user_id: UserId, args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let now = state.env.now();
    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        match channel.chat.delete_messages(
            user_id,
            args.thread_root_message_index,
            args.message_ids,
            args.as_platform_moderator.unwrap_or_default(),
            now,
        ) {
            DeleteMessagesResult::Success(results) => {
                let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
                for message_id in results.into_iter().filter_map(|(message_id, result)| {
                    if let DeleteMessageResult::Success(sender) = result {
                        (sender == user_id).then_some(message_id)
                    } else {
                        None
                    }
                }) {
                    // After 5 minutes hard delete those messages where the deleter was the message sender
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::HardDeleteMessageContent(HardDeleteMessageContentJob {
                            channel_id: args.channel_id,
                            thread_root_message_index: args.thread_root_message_index,
                            message_id,
                        }),
                        remove_deleted_message_content_at,
                        now,
                    );
                }

                handle_activity_notification(state);

                Success
            }
            DeleteMessagesResult::MessageNotFound => MessageNotFound,
            DeleteMessagesResult::UserNotInGroup => UserNotInChannel,
            DeleteMessagesResult::UserSuspended => UserSuspended,
        }
    } else {
        ChannelNotFound
    }
}
