use crate::model::messages_pending::MessagePending;
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{BotMessage, MessageId, UserId};

const MAX_BATCH_SIZE: usize = 10;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.messages_pending.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'process_messages' job started");
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
                trace!("'process_messages' job stopped");
            }
        }
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(UserId, MessageId, MessagePending)>> {
    let mut batch = Vec::new();
    while let Some(next) = state.data.messages_pending.pop() {
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

async fn process_batch(batch: Vec<(UserId, MessageId, MessagePending)>) {
    let futures: Vec<_> = batch
        .into_iter()
        .map(|(user_id, message_id, text)| process_single(user_id, message_id, text))
        .collect();

    futures::future::join_all(futures).await;
}

async fn process_single(user_id: UserId, message_id: MessageId, message: MessagePending) {
    let is_error = match message.clone() {
        MessagePending::Send(content) => {
            let args = user_canister::c2c_handle_bot_messages::Args {
                bot_name: read_state(|state| state.data.username.clone()),
                messages: vec![BotMessage {
                    content,
                    message_id: Some(message_id),
                }],
            };
            user_canister_c2c_client::c2c_handle_bot_messages(user_id.into(), &args)
                .await
                .is_err()
        }
        MessagePending::Edit(content) => {
            let args = user_canister::c2c_edit_message::Args {
                message_id,
                content,
                correlation_id: 0,
            };
            user_canister_c2c_client::c2c_edit_message(user_id.into(), &args)
                .await
                .is_err()
        }
    };

    if is_error {
        mutate_state(|state| {
            state.enqueue_message(user_id, message_id, message, true);
        });
    }
}
