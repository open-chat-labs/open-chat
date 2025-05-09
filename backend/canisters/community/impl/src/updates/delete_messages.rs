use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{RuntimeState, TimerJob, mutate_state, read_state, run_regular_jobs};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::{c2c_bot_delete_messages, delete_messages::*};
use constants::MINUTE_IN_MS;
use oc_error_codes::OCErrorCode;
use types::{Achievement, BotCaller, BotPermissions, Caller, CanisterId, ChatPermission, OCResult};
use user_index_canister_c2c_client::lookup_user;

#[update(candid = true, msgpack = true)]
#[trace]
async fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        caller,
        user_index_canister_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    if args.as_platform_moderator.unwrap_or_default() && caller != user_index_canister_id {
        match lookup_user(caller, user_index_canister_id).await {
            Ok(Some(u)) if u.is_platform_moderator => {}
            Ok(_) => return Response::Error(OCErrorCode::InitiatorNotAuthorized.into()),
            Err(error) => return Response::Error(error.into()),
        }
    }

    mutate_state(|state| delete_messages_impl(args, None, state)).into()
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_delete_messages(args: c2c_bot_delete_messages::Args) -> c2c_bot_delete_messages::Response {
    run_regular_jobs();

    match mutate_state(|state| {
        let bot_caller = BotCaller {
            bot: args.bot_id,
            initiator: args.initiator.clone(),
        };

        let args = Args {
            channel_id: args.channel_id,
            thread_root_message_index: args.thread,
            message_ids: args.message_ids,
            as_platform_moderator: None,
            new_achievement: false,
        };

        if state.data.is_bot_permitted(
            &bot_caller.bot,
            Some(args.channel_id),
            &bot_caller.initiator,
            BotPermissions::from_chat_permission(ChatPermission::DeleteMessages),
        ) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }

        delete_messages_impl(args, Some(Caller::BotV2(bot_caller)), state)
    }) {
        Ok(_) => Response::Success,
        Err(error) => Response::Error(error),
    }
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
}

fn prepare(state: &RuntimeState) -> OCResult<PrepareResult> {
    let caller = state.env.caller();

    Ok(PrepareResult {
        caller,
        user_index_canister_id: state.data.user_index_canister_id,
    })
}

fn delete_messages_impl(args: Args, ext_caller: Option<Caller>, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let caller = state.verified_caller(ext_caller)?;

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    let agent = caller.agent();

    let now = state.env.now();
    let results = channel.chat.delete_messages(
        caller,
        args.thread_root_message_index,
        args.message_ids,
        args.as_platform_moderator.unwrap_or_default(),
        now,
    )?;

    let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
    for message_id in
        results.into_iter().filter_map(
            |(message_id, result)| {
                if let Ok(sender) = result { (sender == agent).then_some(message_id) } else { None }
            },
        )
    {
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

    if args.new_achievement {
        state.notify_user_of_achievement(agent, Achievement::DeletedMessage, now);
    }

    handle_activity_notification(state);
    Ok(())
}
