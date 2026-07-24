use crate::model::moderation_queue::QueueItem;
use crate::{CommunityEvent, GroupEvent, RuntimeState, mutate_state};
use group_community_common::openai_moderation::{self, Classification};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{MessageClassified, ModerationReferralConfig};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static CONSECUTIVE_FAILURES: Cell<u32> = Cell::default();
}

const INTERVAL: Duration = Duration::from_secs(10);
const MAX_BACKOFF: Duration = Duration::from_secs(300);
// Text inputs from all sources are classified in a single call to the moderation API
const BATCH_SIZE: usize = 32;
// Image-bearing messages are classified individually, so cap the number of outcalls per batch
const MAX_IMAGE_INPUTS_PER_BATCH: usize = 5;
const MAX_ATTEMPTS: u8 = 3;

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

    if let Some((api_key, moderation_referral_config, batch)) = mutate_state(next_batch) {
        // TIMER_ID is deliberately left set while the batch is in flight so that an enqueue
        // during the outcall cannot arm a second concurrent batch; it is cleared, and the timer
        // re-armed if required, when the batch completes
        ic_cdk::futures::spawn(process_batch(api_key, moderation_referral_config, batch));
    } else {
        TIMER_ID.set(None);
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<(String, Option<ModerationReferralConfig>, Vec<QueueItem>)> {
    let api_key = state.data.openai_api_key.clone()?;
    let batch = state
        .data
        .message_moderation_queue
        .next_batch(BATCH_SIZE, MAX_IMAGE_INPUTS_PER_BATCH);
    (!batch.is_empty()).then_some((api_key, state.data.moderation_referral_config, batch))
}

async fn process_batch(api_key: String, moderation_referral_config: Option<ModerationReferralConfig>, batch: Vec<QueueItem>) {
    let mut classified: Vec<(QueueItem, Classification)> = Vec::new();
    let mut failed: Vec<QueueItem> = Vec::new();

    let (image_items, text_items): (Vec<_>, Vec<_>) = batch.into_iter().partition(|i| !i.entry.input.image_urls.is_empty());

    if !text_items.is_empty() {
        let texts: Vec<String> = text_items
            .iter()
            .map(|i| i.entry.input.text.clone().unwrap_or_default())
            .collect();
        match openai_moderation::classify_text_batch(&api_key, &texts, moderation_referral_config).await {
            Ok(results) => classified.extend(text_items.into_iter().zip(results)),
            Err(error) => {
                error!(?error, "Failed to classify messages for moderation");
                failed.extend(text_items);
            }
        }
    }

    for item in image_items {
        match openai_moderation::classify_input(&api_key, &item.entry.input, moderation_referral_config).await {
            Ok(classification) => classified.push((item, classification)),
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
        for (item, classification) in classified {
            let result = MessageClassified {
                channel_id: item.channel_id,
                thread_root_message_index: item.entry.thread_root_message_index,
                message_id: item.message_id,
                flags: classification.flagged.bits(),
                moderation_referral_flags: classification.moderation_referral.bits(),
            };
            if item.is_group {
                state.push_event_to_group(item.source, GroupEvent::MessageClassified(result), now);
            } else {
                state.push_event_to_community(item.source, CommunityEvent::MessageClassified(result), now);
            }
        }
        for mut item in failed {
            item.entry.attempts += 1;
            if item.entry.attempts < MAX_ATTEMPTS {
                state.data.message_moderation_queue.requeue(item);
            }
        }
        TIMER_ID.set(None);
        start_job_if_required(state);
    });
}
