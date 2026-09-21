use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{DeleteUndeleteMessagesArgs, Reader};
use oc_error_codes::OCErrorCode;
use types::{EventIndex, OCResult};
use user_canister::undelete_messages::{Response::*, *};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn undelete_messages(args: Args) -> Response {
    match mutate_state(|state| undelete_messages_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    // Undelete the messages in the caller's copy of the chat, which only works for messages they
    // deleted themselves
    let (undeleted, messages, thread_root_message_id) = state
        .data
        .users
        .with_user_mut(my_index, |user| -> OCResult<_> {
            user.verify_not_suspended()?;

            let chat = user.direct_chats.get_mut_or_err(&args.user_id.into())?;

            let undeleted: Vec<_> = chat
                .undelete_messages(DeleteUndeleteMessagesArgs {
                    caller: my_user_id,
                    is_admin: false,
                    min_visible_event_index: EventIndex::default(),
                    thread_root_message_index: args.thread_root_message_index,
                    message_ids: args.message_ids,
                    now,
                })
                .into_iter()
                .filter_map(|(message_id, result)| result.is_ok().then_some(message_id))
                .collect();

            let events_reader = chat
                .events_reader(args.thread_root_message_index)
                .ok_or(OCErrorCode::ThreadNotFound)?;

            let messages: Vec<_> = undeleted
                .iter()
                .filter_map(|&message_id| events_reader.message(message_id.into(), Some(my_user_id)))
                .collect();

            let thread_root_message_id = if undeleted.is_empty() {
                None
            } else {
                chat.thread_root_message_id(args.thread_root_message_index)?
            };
            Ok((undeleted, messages, thread_root_message_id))
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    HardDeleteMessageContentJob::cancel(
        &mut state.data.timer_jobs,
        my_index,
        args.user_id.into(),
        args.thread_root_message_index,
        &undeleted,
    );

    // Then in the other user's copy, where the thread is identified by the id of its root message
    // since message indexes differ between the copies
    // TODO: A user in another canister needs sending `UndeleteMessages`, as the User canister does
    if !undeleted.is_empty()
        && let Some(their_index) = state.index_of_local_user(args.user_id)
        && let Some((thread_root_message_index, undeleted_in_theirs)) = state
            .with_their_direct_chat_mut(my_user_id, args.user_id, |chat| {
                let thread_root_message_index = chat.thread_root_message_index(thread_root_message_id).ok()?;
                let undeleted: Vec<_> = chat
                    .undelete_messages(DeleteUndeleteMessagesArgs {
                        caller: my_user_id,
                        is_admin: false,
                        min_visible_event_index: EventIndex::default(),
                        thread_root_message_index,
                        message_ids: undeleted,
                        now,
                    })
                    .into_iter()
                    .filter_map(|(message_id, result)| result.is_ok().then_some(message_id))
                    .collect();
                Some((thread_root_message_index, undeleted))
            })
            .flatten()
    {
        HardDeleteMessageContentJob::cancel(
            &mut state.data.timer_jobs,
            their_index,
            my_user_id.into(),
            thread_root_message_index,
            &undeleted_in_theirs,
        );
    }

    Ok(SuccessResult { messages })
}
