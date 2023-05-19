use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState, TimerJob};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::DeleteMessageResult;
use group_canister::delete_messages::{Response::*, *};
use group_chat_core::{DeleteMessagesResult, DeleteMessagesSuccess};
use ic_cdk_macros::update;
use types::{CanisterId, UserId};
use user_index_canister_c2c_client::lookup_user;
use utils::time::MINUTE_IN_MS;

#[update]
#[trace]
async fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

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

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.principal_to_user_id_map.get(&caller).copied() {
        Ok(PrepareResult {
            caller,
            user_id,
            user_index_canister_id: runtime_state.data.user_index_canister_id,
        })
    } else {
        Err(CallerNotInGroup)
    }
}

fn delete_messages_impl(user_id: UserId, args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let now = runtime_state.env.now();
    match runtime_state.data.chat.delete_messages(
        user_id,
        args.thread_root_message_index,
        args.message_ids,
        args.as_platform_moderator.unwrap_or_default(),
        now,
    ) {
        DeleteMessagesResult::Success(DeleteMessagesSuccess { results, my_messages }) => {
            let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
            for message_id in results
                .into_iter()
                .filter(|(_, result)| matches!(result, DeleteMessageResult::Success(_)))
                .map(|(message_id, _)| message_id)
                .filter(|message_id| my_messages.contains(message_id))
            {
                // After 5 minutes hard delete those messages where the deleter was the message sender
                runtime_state.data.timer_jobs.enqueue_job(
                    TimerJob::HardDeleteMessageContent(HardDeleteMessageContentJob {
                        thread_root_message_index: args.thread_root_message_index,
                        message_id,
                    }),
                    remove_deleted_message_content_at,
                    now,
                );
            }

            handle_activity_notification(runtime_state);

            Success
        }
        DeleteMessagesResult::MessageNotFound => MessageNotFound,
        DeleteMessagesResult::UserNotInGroup => CallerNotInGroup,
        DeleteMessagesResult::UserSuspended => UserSuspended,
    }
}
