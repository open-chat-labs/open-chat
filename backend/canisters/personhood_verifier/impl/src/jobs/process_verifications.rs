use crate::engine;
use crate::model::embeddings::ScanOutcome;
use crate::model::sessions::SessionStatus;
use crate::{RuntimeState, mutate_state, read_state};
use ic_cdk_timers::TimerId;
use personhood_verifier_canister::{VerificationFailureReason, VerificationRetryReason};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{CanisterId, UserId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.processing_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'process_verifications' job started");
        true
    } else {
        false
    }
}

fn run() {
    TIMER_ID.set(None);
    // One verification per timer execution. The real pipeline splits further:
    // one model inference per execution (DTS budgeting) - Phase 2.
    if let Some(verified) = mutate_state(process_next) {
        ic_cdk::futures::spawn(notify_user_index(verified));
    }
    read_state(start_job_if_required);
}

struct Verified {
    user_id: UserId,
    model_version: u16,
    user_index_canister_id: CanisterId,
}

fn process_next(state: &mut RuntimeState) -> Option<Verified> {
    let now = state.env.now();
    let session_id = state.data.processing_queue.pop_front()?;
    let model_version = state.data.current_model_version;

    let Some(session) = state.data.sessions.get_mut(session_id) else {
        return None;
    };
    if session.deadline <= now {
        session.status = SessionStatus::Failed {
            reason: VerificationFailureReason::SessionExpired,
        };
        return None;
    }
    session.status = SessionStatus::Processing;

    let frames: Vec<_> = session.frames.iter().flatten().cloned().collect();
    let result = engine::compute_embedding(&frames);
    // Privacy invariant: raw frames are dropped as soon as the embedding
    // (or a failure) has been computed
    session.drop_frames();

    let user_id = session.user_id;
    let is_retry_round = session.is_retry_round;

    let embedding = match result {
        Ok(embedding) => embedding,
        Err(reason) => {
            session.status = SessionStatus::Failed { reason };
            return None;
        }
    };

    let duplicate_threshold = if is_retry_round { engine::DUPLICATE_THRESHOLD_RETRY } else { engine::DUPLICATE_THRESHOLD };
    let outcome = state.data.embeddings.scan(
        model_version,
        &embedding,
        &user_id,
        duplicate_threshold,
        engine::CLEAR_THRESHOLD,
    );

    let session = state.data.sessions.get_mut(session_id).expect("session exists");
    match outcome {
        ScanOutcome::Unique => {
            state.data.embeddings.insert(model_version, user_id, embedding);
            session.status = SessionStatus::Verified { model_version };
            let user_index_canister_id = state.data.user_index_canister_id;
            Some(Verified {
                user_id,
                model_version,
                user_index_canister_id,
            })
        }
        ScanOutcome::Inconclusive if !is_retry_round => {
            session.status = SessionStatus::RetryRequired {
                reason: VerificationRetryReason::InconclusiveMatch,
            };
            state.data.attempts.entry(user_id).or_default().permit_retry(now);
            None
        }
        // Retry round exhausted (or clear duplicate): hard fail, and the
        // response never identifies the matching account
        ScanOutcome::Inconclusive | ScanOutcome::Duplicate => {
            session.status = SessionStatus::Failed {
                reason: VerificationFailureReason::NotUnique,
            };
            None
        }
    }
}

async fn notify_user_index(verified: Verified) {
    let args = user_index_canister::c2c_notify_personhood_verified::Args {
        user_id: verified.user_id,
        model_version: verified.model_version,
    };
    for _ in 0..3 {
        match user_index_canister_c2c_client::c2c_notify_personhood_verified(verified.user_index_canister_id, &args).await {
            Ok(_) => return,
            Err(err) => {
                error!(?err, user_id = %verified.user_id, "Failed to notify user_index of verified personhood");
            }
        }
    }
}
