use crate::model::pending_modclub_submissions_queue::PendingModclubSubmission;
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};
use types::CanisterId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.pending_modclub_submissions_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        true
    } else {
        false
    }
}

pub fn run() {
    info!("'submit_message_to_modclub' job running");
    TIMER_ID.set(None);

    let (pending_submission, modclub_canister_id) = mutate_state(|state| {
        (
            state.data.pending_modclub_submissions_queue.pop(),
            state.modclub_canister_id(),
        )
    });

    if let Some(pending_submission) = pending_submission {
        ic_cdk::spawn(process_submission(modclub_canister_id, pending_submission));
    }

    read_state(start_job_if_required);
}

async fn process_submission(modclub_canister_id: CanisterId, pending_submission: PendingModclubSubmission) {
    let success = submit_message(modclub_canister_id, &pending_submission).await;

    mutate_state(|state| {
        if !success {
            state.data.pending_modclub_submissions_queue.push(pending_submission);
        }
        start_job_if_required(state);
    });
}

async fn submit_message(modclub_canister_id: CanisterId, pending_submission: &PendingModclubSubmission) -> bool {
    info!("'submit_message_to_modclub' submit_message");

    let args = (
        pending_submission.report_index.to_string(),
        pending_submission.html_report.clone(),
        Some(pending_submission.title.clone()),
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
