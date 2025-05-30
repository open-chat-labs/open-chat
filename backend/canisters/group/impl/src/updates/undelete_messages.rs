use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, TimerJob, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::undelete_messages::{Response::*, *};
use std::collections::HashSet;
use types::OCResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn undelete_messages(args: Args) -> Response {
    match execute_update(|state| undelete_messages_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();
    let results = state
        .data
        .chat
        .undelete_messages(user_id, args.thread_root_message_index, args.message_ids, now)?;

    if results.is_empty() {
        return Ok(SuccessResult { messages: vec![] });
    }

    let (messages, bot_notifications): (Vec<_>, Vec<_>) = results
        .into_iter()
        .map(|success| (success.message, success.bot_notification))
        .unzip();

    for notification in bot_notifications.into_iter().flatten() {
        state.push_bot_notification(notification);
    }

    let message_ids: HashSet<_> = messages.iter().map(|m| m.message_id).collect();
    state.data.timer_jobs.cancel_jobs(|job| {
        if let TimerJob::HardDeleteMessageContent(j) = job {
            j.thread_root_message_index == args.thread_root_message_index && message_ids.contains(&j.message_id)
        } else {
            false
        }
    });

    handle_activity_notification(state);

    Ok(SuccessResult { messages })
}
