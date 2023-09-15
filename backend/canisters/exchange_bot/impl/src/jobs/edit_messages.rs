use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{MessageContent, MessageId, TextContent, UserId};

const MAX_BATCH_SIZE: usize = 10;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.message_edits_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'edit_messages' job started");
        true
    } else {
        false
    }
}

fn run() {
    match mutate_state(next_batch) {
        Some(batch) => ic_cdk::spawn(process_batch(batch)),
        None => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'edit_messages' job stopped");
            }
        }
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(UserId, MessageId, String)>> {
    let mut batch = Vec::new();
    while let Some(next) = state.data.message_edits_queue.pop() {
        batch.push(next);
        if batch.len() == MAX_BATCH_SIZE {
            break;
        }
    }
    if !batch.is_empty() {
        Some(batch)
    } else {
        None
    }
}

async fn process_batch(batch: Vec<(UserId, MessageId, String)>) {
    let futures: Vec<_> = batch
        .into_iter()
        .map(|(user_id, message_id, text)| process_single(user_id, message_id, text))
        .collect();

    futures::future::join_all(futures).await;
}

async fn process_single(user_id: UserId, message_id: MessageId, text: String) {
    let args = user_canister::c2c_edit_message::Args {
        message_id,
        content: MessageContent::Text(TextContent { text: text.clone() }),
        correlation_id: 0,
    };
    if user_canister_c2c_client::c2c_edit_message(user_id.into(), &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            state.enqueue_message_edit(user_id, message_id, text, false);
        });
    }
}
