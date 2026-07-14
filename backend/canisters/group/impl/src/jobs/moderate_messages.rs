use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, mutate_state};
use group_community_common::openai_moderation::{self, PendingMessageModeration};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{EventIndex, ModerationCategories};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const INTERVAL: Duration = Duration::from_secs(10);
const BATCH_SIZE: usize = 20;
const MAX_ATTEMPTS: u8 = 3;

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.openai_api_key.is_some() && !state.data.message_moderation_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(INTERVAL, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'moderate_messages' job running");
    TIMER_ID.set(None);

    if let Some((api_key, batch)) = mutate_state(next_batch) {
        ic_cdk::futures::spawn(process_batch(api_key, batch));
    }
}

struct Item {
    entry: PendingMessageModeration,
    text: String,
}

fn next_batch(state: &mut RuntimeState) -> Option<(String, Vec<Item>)> {
    let api_key = state.data.openai_api_key.clone()?;

    if !state.data.chat.is_public.value {
        state.data.message_moderation_queue.clear();
        return None;
    }

    let mut batch = Vec::new();
    while batch.len() < BATCH_SIZE {
        let Some(entry) = state.data.message_moderation_queue.pop_front() else {
            break;
        };

        if let Some((message, _)) = state.data.chat.events.message_internal(
            EventIndex::default(),
            entry.thread_root_message_index,
            entry.message_id.into(),
        ) && message.deleted_by.is_none()
            && let Some(text) = message.content.text()
        {
            let text = text.to_string();
            batch.push(Item { entry, text });
        }
    }

    (!batch.is_empty()).then_some((api_key, batch))
}

async fn process_batch(api_key: String, batch: Vec<Item>) {
    let texts: Vec<String> = batch.iter().map(|i| i.text.clone()).collect();

    match openai_moderation::moderate(&api_key, &texts).await {
        Ok(results) => mutate_state(|state| {
            let now = state.env.now();
            let mut any_flagged = false;
            for (item, categories) in batch.into_iter().zip(results) {
                if !categories.is_empty()
                    && state
                        .data
                        .chat
                        .events
                        .flag_message(item.entry.thread_root_message_index, item.entry.message_id, categories, now)
                        .is_ok()
                {
                    any_flagged = true;

                    if categories.contains(ModerationCategories::SEXUAL_MINORS) {
                        // TODO: Trigger the CSAM auto-sanction (escalation issue)
                    }
                }
            }
            if any_flagged {
                handle_activity_notification(state);
            }
            start_job_if_required(state);
        }),
        Err(error) => {
            error!(?error, "Failed to classify messages for moderation");
            mutate_state(|state| {
                for mut item in batch {
                    item.entry.attempts += 1;
                    if item.entry.attempts < MAX_ATTEMPTS {
                        state.data.message_moderation_queue.push_back(item.entry);
                    }
                }
                start_job_if_required(state);
            });
        }
    }
}
