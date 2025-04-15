use crate::guards::caller_is_owner;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::DeleteUndeleteMessagesArgs;
use constants::{MINUTE_IN_MS, OPENCHAT_BOT_USER_ID};
use types::{Achievement, EventIndex, OCResult};
use user_canister::delete_messages::{Response::*, *};
use user_canister::UserCanisterEvent;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| delete_messages_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn delete_messages_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    let chat = state.data.direct_chats.get_mut_or_err(&args.user_id.into())?;
    let my_user_id = state.env.canister_id().into();
    let now = state.env.now();

    let delete_message_results = chat.events.delete_messages(DeleteUndeleteMessagesArgs {
        caller: my_user_id,
        is_admin: true,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index: None,
        message_ids: args.message_ids,
        now,
    });

    let deleted: Vec<_> = delete_message_results
        .into_iter()
        .filter_map(
            |(message_id, result)| {
                if let Ok(u) = result {
                    Some((message_id, u))
                } else {
                    None
                }
            },
        )
        .collect();

    if !deleted.is_empty() {
        let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
        for (message_id, _) in deleted.iter().copied() {
            state.data.timer_jobs.enqueue_job(
                TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
                    chat_id: args.user_id.into(),
                    thread_root_message_index: None,
                    message_id,
                })),
                remove_deleted_message_content_at,
                now,
            );
        }

        if args.user_id != OPENCHAT_BOT_USER_ID {
            let my_messages: Vec<_> = deleted
                .iter()
                .filter(|(_, u)| *u == my_user_id)
                .map(|(id, _)| id)
                .copied()
                .collect();

            if !my_messages.is_empty() {
                let thread_root_message_id = args.thread_root_message_index.map(|i| chat.main_message_index_to_id(i));

                state.push_user_canister_event(
                    args.user_id.into(),
                    UserCanisterEvent::DeleteMessages(Box::new(user_canister::DeleteUndeleteMessagesArgs {
                        thread_root_message_id,
                        message_ids: my_messages,
                    })),
                );
            }

            state.award_achievement_and_notify(Achievement::DeletedMessage, now)
        }
    }

    Ok(())
}
