use crate::model::moderation_queue::QueueItem;
use crate::{CommunityEvent, GroupEvent, RuntimeState, mutate_state};
use group_community_common::openai_moderation::{self, Classification, ModerationApiError};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{MessageClassified, ModerationReferralConfig};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static CONSECUTIVE_FAILURES: Cell<u32> = Cell::default();
    // Pacing/backoff hints from the last completed batch, consumed by next_interval
    static PACE_DELAY: Cell<Duration> = Cell::default();
    static RETRY_AFTER: Cell<Option<Duration>> = Cell::default();
}

const INTERVAL: Duration = Duration::from_secs(10);
const MAX_BACKOFF: Duration = Duration::from_secs(300);
// Every queued input is text (media is never classified - #9149), so a whole batch is one call
// to the moderation API. Batches are additionally capped by estimated tokens, and paced so
// that this canister stays under PACE_TOKENS_PER_SECOND, keeping a fleet of indexes inside
// the org-wide tokens-per-minute limit while a deep queue drains (10k TPM on
// omni-moderation-latest at the current tier; 3 indexes x 50/s = 9k TPM).
const BATCH_SIZE: usize = 32;
const BATCH_MAX_ESTIMATED_TOKENS: usize = 2_500;
const PACE_TOKENS_PER_SECOND: usize = 50;
// Attempts only count deterministic rejections of the request (4xx); throttles and outages
// instead bound queue residency by age
const MAX_ATTEMPTS: u8 = 3;
const MAX_QUEUE_AGE_MS: u64 = 24 * 60 * 60 * 1000;

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.openai_api_key.is_some() && !state.data.message_moderation_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(next_interval(), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

// Backs off exponentially while the API is failing so that an outage isn't hammered every
// tick, honours any Retry-After the API sent, and stretches to the token-pacing delay owed
// for the previous batch
fn next_interval() -> Duration {
    let backoff = INTERVAL
        .saturating_mul(2u32.saturating_pow(CONSECUTIVE_FAILURES.get()))
        .min(MAX_BACKOFF);
    let retry_after = RETRY_AFTER.get().unwrap_or_default();
    backoff.max(retry_after).max(PACE_DELAY.get())
}

pub fn run() {
    trace!("'moderate_messages' job running");

    if let Some((api_key, moderation_referral_config, batch)) = mutate_state(next_batch) {
        // TIMER_ID is deliberately left set while the batch is in flight so that an enqueue
        // during the outcall cannot arm a second concurrent batch; it is cleared, and the timer
        // re-armed if required, when the batch completes
        ic_cdk::futures::spawn_migratory(process_batch(api_key, moderation_referral_config, batch));
    } else {
        TIMER_ID.set(None);
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<(String, Option<ModerationReferralConfig>, Vec<QueueItem>)> {
    let api_key = state.data.openai_api_key.clone()?;
    let (batch, unclassifiable) = state
        .data
        .message_moderation_queue
        .next_batch(BATCH_SIZE, BATCH_MAX_ESTIMATED_TOKENS);
    // Media-only entries queued by pre-#9149 senders get an empty classification without an
    // API call, so that stale flags from earlier content are still cleared
    let now = state.env.now();
    for item in unclassifiable {
        push_classification(item, Classification::default(), now, state);
    }
    (!batch.is_empty()).then_some((api_key, state.data.moderation_referral_config.clone(), batch))
}

async fn process_batch(api_key: String, moderation_referral_config: Option<ModerationReferralConfig>, batch: Vec<QueueItem>) {
    let texts: Vec<String> = batch.iter().map(|i| i.entry.input.text.clone().unwrap_or_default()).collect();

    // Owed pacing delay for the tokens this batch spends, consumed by next_interval
    let estimated_tokens: usize = texts.iter().map(|t| t.len() / 4).sum();
    PACE_DELAY.set(Duration::from_secs((estimated_tokens / PACE_TOKENS_PER_SECOND) as u64));

    // `charge_attempt` is false for throttles and outages: they say nothing about the batch,
    // so the messages are requeued unpenalised (bounded by queue age instead)
    let (classified, failed, charge_attempt): (Vec<(QueueItem, Classification)>, Vec<QueueItem>, bool) =
        match openai_moderation::classify_text_batch(&api_key, &texts, moderation_referral_config.as_ref()).await {
            Ok(results) => (batch.into_iter().zip(results).collect(), Vec::new(), false),
            Err(ModerationApiError::Retryable { message, retry_after }) => {
                error!(message, "Failed to classify messages for moderation (will retry)");
                RETRY_AFTER.set(retry_after);
                (Vec::new(), batch, false)
            }
            Err(ModerationApiError::Rejected { message }) => {
                error!(message, "Moderation API rejected the batch");
                (Vec::new(), batch, true)
            }
        };

    if classified.is_empty() && !failed.is_empty() {
        CONSECUTIVE_FAILURES.set(CONSECUTIVE_FAILURES.get().saturating_add(1));
    } else {
        CONSECUTIVE_FAILURES.set(0);
        RETRY_AFTER.set(None);
    }

    mutate_state(|state| {
        let now = state.env.now();
        for (item, classification) in classified {
            // A key superseded while in flight (an edit removed all classifiable content) has
            // already been sent an empty classification: pushing this result would re-apply
            // flags derived from the removed content, with nothing following to clear them
            if state
                .data
                .message_moderation_queue
                .finish_in_flight(item.source, item.channel_id, item.message_id)
            {
                continue;
            }
            push_classification(item, classification, now, state);
        }
        for mut item in failed {
            let superseded =
                state
                    .data
                    .message_moderation_queue
                    .finish_in_flight(item.source, item.channel_id, item.message_id);
            if superseded {
                continue;
            }
            if charge_attempt {
                item.entry.attempts += 1;
            }
            // Entries queued before queued_at existed carry 0; start their clock now
            if item.entry.queued_at == 0 {
                item.entry.queued_at = now;
            }
            if item.entry.attempts >= MAX_ATTEMPTS {
                error!(
                    message_id = ?item.message_id,
                    "Message dropped from moderation queue: rejected {MAX_ATTEMPTS} times"
                );
            } else if now.saturating_sub(item.entry.queued_at) > MAX_QUEUE_AGE_MS {
                error!(
                    message_id = ?item.message_id,
                    "Message dropped from moderation queue: unclassified after 24h"
                );
            } else {
                state.data.message_moderation_queue.requeue(item);
            }
        }
        TIMER_ID.set(None);
        start_job_if_required(state);
    });
}

fn push_classification(item: QueueItem, classification: Classification, now: u64, state: &mut RuntimeState) {
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
