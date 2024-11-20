use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState, TimerJob};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::DeleteMessageResult;
use group_canister::delete_messages::{Response::*, *};
use group_chat_core::DeleteMessagesResult;
use types::{Achievement, CanisterId, UserId};
use user_index_canister_c2c_client::lookup_user;
use utils::consts::OPENCHAT_BOT_USER_ID;
use utils::time::MINUTE_IN_MS;

#[update(candid = true, msgpack = true)]
#[trace]
async fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        caller,
        user_id,
        user_index_canister_id,
        is_bot,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if args.as_platform_moderator.unwrap_or_default() && caller != user_index_canister_id {
        match lookup_user(caller, user_index_canister_id).await {
            Ok(u) if u.is_platform_moderator => {}
            Ok(_) => return NotPlatformModerator,
            Err(error) => return InternalError(format!("{error:?}")),
        }
    }

    mutate_state(|state| delete_messages_impl(user_id, is_bot, args, state))
}

struct PrepareResult {
    caller: Principal,
    user_id: UserId,
    user_index_canister_id: CanisterId,
    is_bot: bool,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    let (user_id, is_bot) =
        if let Some((user_id, is_bot)) = state.data.get_member(caller).map(|m| (m.user_id(), m.user_type().is_bot())) {
            (user_id, is_bot)
        } else if caller == state.data.user_index_canister_id {
            (OPENCHAT_BOT_USER_ID, true)
        } else {
            return Err(CallerNotInGroup);
        };

    Ok(PrepareResult {
        caller,
        user_id,
        user_index_canister_id: state.data.user_index_canister_id,
        is_bot,
    })
}

fn delete_messages_impl(user_id: UserId, is_bot: bool, args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let now = state.env.now();
    match state.data.chat.delete_messages(
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
                        thread_root_message_index: args.thread_root_message_index,
                        message_id,
                    }),
                    remove_deleted_message_content_at,
                    now,
                );
            }

            if args.new_achievement && !is_bot {
                state.data.notify_user_of_achievement(user_id, Achievement::DeletedMessage);
            }

            handle_activity_notification(state);

            Success
        }
        DeleteMessagesResult::MessageNotFound => MessageNotFound,
        DeleteMessagesResult::UserNotInGroup => CallerNotInGroup,
        DeleteMessagesResult::UserSuspended => UserSuspended,
        DeleteMessagesResult::UserLapsed => UserLapsed,
    }
}
