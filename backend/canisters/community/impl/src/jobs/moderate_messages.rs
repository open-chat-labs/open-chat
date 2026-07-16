use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, mutate_state};
use group_community_common::openai_moderation::{self, PendingMessageModeration};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace, warn};
use types::{ChannelId, EventIndex, ModerationCategories, ModerationInput};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static CONSECUTIVE_FAILURES: Cell<u32> = Cell::default();
}

const INTERVAL: Duration = Duration::from_secs(10);
const MAX_BACKOFF: Duration = Duration::from_secs(300);
const BATCH_SIZE: usize = 20;
// Image-bearing messages are classified individually, so cap the number of outcalls per batch
const MAX_IMAGE_INPUTS_PER_BATCH: usize = 5;
const MAX_ATTEMPTS: u8 = 3;
// Cap the queue so that a prolonged API outage or a flood of messages cannot grow it unboundedly
const MAX_QUEUE_SIZE: usize = 10_000;

pub(crate) fn enqueue(state: &mut RuntimeState, channel_id: ChannelId, entry: PendingMessageModeration) {
    // Drop the oldest entries when full so that the most recent messages still get moderated
    while state.data.message_moderation_queue.len() >= MAX_QUEUE_SIZE {
        state.data.message_moderation_queue.pop_front();
        warn!("Message moderation queue full, dropping oldest entry");
    }
    state.data.message_moderation_queue.push_back((channel_id, entry));
    start_job_if_required(state);
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.openai_api_key.is_some() && !state.data.message_moderation_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(next_interval(), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

// Backs off exponentially while the API is failing so that an outage isn't hammered every tick
fn next_interval() -> Duration {
    INTERVAL
        .saturating_mul(2u32.saturating_pow(CONSECUTIVE_FAILURES.get()))
        .min(MAX_BACKOFF)
}

pub fn run() {
    trace!("'moderate_messages' job running");
    TIMER_ID.set(None);

    if let Some((api_key, batch)) = mutate_state(next_batch) {
        ic_cdk::futures::spawn(process_batch(api_key, batch));
    }
}

struct Item {
    channel_id: ChannelId,
    entry: PendingMessageModeration,
    input: ModerationInput,
}

fn next_batch(state: &mut RuntimeState) -> Option<(String, Vec<Item>)> {
    let api_key = state.data.openai_api_key.clone()?;

    if !state.data.is_public.value {
        state.data.message_moderation_queue.clear();
        return None;
    }

    let mut batch = Vec::new();
    let mut image_inputs = 0;
    while batch.len() < BATCH_SIZE {
        let Some((channel_id, entry)) = state.data.message_moderation_queue.pop_front() else {
            break;
        };

        let Some(channel) = state.data.channels.get(&channel_id) else {
            continue;
        };

        if channel.chat.is_public.value
            && let Some((message, _)) = channel.chat.events.message_internal(
                EventIndex::default(),
                entry.thread_root_message_index,
                entry.message_id.into(),
            )
            && message.deleted_by.is_none()
        {
            let input = message.content.moderation_input();
            if input.is_empty() {
                continue;
            }
            if !input.image_urls.is_empty() {
                if image_inputs == MAX_IMAGE_INPUTS_PER_BATCH {
                    state.data.message_moderation_queue.push_front((channel_id, entry));
                    break;
                }
                image_inputs += 1;
            }
            batch.push(Item {
                channel_id,
                entry,
                input,
            });
        }
    }

    (!batch.is_empty()).then_some((api_key, batch))
}

async fn process_batch(api_key: String, batch: Vec<Item>) {
    let mut classified: Vec<(Item, ModerationCategories)> = Vec::new();
    let mut failed: Vec<Item> = Vec::new();

    let (image_items, text_items): (Vec<_>, Vec<_>) = batch.into_iter().partition(|i| !i.input.image_urls.is_empty());

    if !text_items.is_empty() {
        let texts: Vec<String> = text_items.iter().map(|i| i.input.text.clone().unwrap_or_default()).collect();
        match openai_moderation::moderate_text_batch(&api_key, &texts).await {
            Ok(results) => classified.extend(text_items.into_iter().zip(results)),
            Err(error) => {
                error!(?error, "Failed to classify messages for moderation");
                failed.extend(text_items);
            }
        }
    }

    for item in image_items {
        match openai_moderation::moderate_input(&api_key, &item.input).await {
            Ok(categories) => classified.push((item, categories)),
            Err(error) => {
                error!(?error, "Failed to classify message for moderation");
                failed.push(item);
            }
        }
    }

    if classified.is_empty() && !failed.is_empty() {
        CONSECUTIVE_FAILURES.set(CONSECUTIVE_FAILURES.get().saturating_add(1));
    } else {
        CONSECUTIVE_FAILURES.set(0);
    }

    mutate_state(|state| {
        let now = state.env.now();
        let mut any_flagged = false;
        for (item, categories) in classified {
            // An empty result still calls flag_message so that stale flags are cleared if a
            // previously flagged message has been edited to something clean
            if let Some(channel) = state.data.channels.get_mut(&item.channel_id)
                && channel
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
        for mut item in failed {
            item.entry.attempts += 1;
            if item.entry.attempts < MAX_ATTEMPTS {
                state.data.message_moderation_queue.push_back((item.channel_id, item.entry));
            }
        }
        start_job_if_required(state);
    });
}
