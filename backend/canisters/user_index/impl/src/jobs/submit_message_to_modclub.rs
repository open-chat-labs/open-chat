use crate::model::pending_modclub_submissions_queue::PendingModclubSubmission;
use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::CanisterId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.pending_modclub_submissions_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'submit_message_to_modclub' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    let (pending_payment, modclub_canister_id) = mutate_state(|state| {
        (
            state.data.pending_modclub_submissions_queue.pop(),
            state.modclub_canister_id(),
        )
    });

    if let Some(pending_payment) = pending_payment {
        ic_cdk::spawn(process_submission(modclub_canister_id, pending_payment));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'submit_message_to_modclub' job stopped");
    }
}

async fn process_submission(modclub_canister_id: CanisterId, pending_submission: PendingModclubSubmission) {
    if !submit_message(modclub_canister_id, &pending_submission).await {
        mutate_state(|state| {
            state.data.pending_modclub_submissions_queue.push(pending_submission);
            start_job_if_required(state);
        });
    }
}

async fn submit_message(modclub_canister_id: CanisterId, pending_submission: &PendingModclubSubmission) -> bool {
    let args = (
        pending_submission.report_index.to_string(),
        pending_submission.html_report.clone(),
        None,
        Some(pending_submission.level),
    );
    match modclub_canister_c2c_client::submitHtmlContent(modclub_canister_id, args).await {
        Ok(_) => true,
        Err(error) => {
            error!(?error, "Modclub submission failed");
            false
        }
    }
}
