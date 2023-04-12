use crate::guards::caller_is_owner;
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, Reader};
use ic_cdk_macros::update;
use types::{ChatId, EventIndex, MessageContentInitial, MessageContentInternal, MessageIndex, TextContent};
use user_canister::clear_message_reminder::{Response::*, *};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner")]
#[trace]
fn clear_message_reminder(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| clear_message_reminder_impl(args.chat_id, args.thread_root_message_index, args.event_index, state));

    Success
}

pub(crate) fn clear_message_reminder_impl(
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    event_index: EventIndex,
    state: &mut RuntimeState,
) {
    let bot_message_ids: Vec<_> = state
        .data
        .timer_jobs
        .cancel_jobs(|j| {
            if let TimerJob::MessageReminder(job) = j {
                job.chat_id == chat_id
                    && job.thread_root_message_index == thread_root_message_index
                    && job.event_index == event_index
            } else {
                false
            }
        })
        .into_iter()
        .filter_map(
            |job| {
                if let TimerJob::MessageReminder(j) = job {
                    Some(j.bot_message_id)
                } else {
                    None
                }
            },
        )
        .collect();

    if !bot_message_ids.is_empty() {
        if let Some(chat) = state.data.direct_chats.get_mut(&OPENCHAT_BOT_USER_ID.into()) {
            let now = state.env.now();
            for message_id in bot_message_ids {
                if let Some(original_text) = chat
                    .events
                    .main_events_reader(now)
                    .message_event_internal(message_id.into())
                    .map(|e| &e.event.content)
                    .and_then(|c| if let MessageContentInternal::Text(t) = c { Some(t.text.as_str()) } else { None })
                {
                    chat.events.edit_message(EditMessageArgs {
                        sender: OPENCHAT_BOT_USER_ID,
                        min_visible_event_index: EventIndex::default(),
                        thread_root_message_index: None,
                        message_id,
                        content: MessageContentInitial::Text(TextContent {
                            text: format!("~{original_text}~"),
                        }),
                        now,
                    });
                }
            }
        }
    }
}
