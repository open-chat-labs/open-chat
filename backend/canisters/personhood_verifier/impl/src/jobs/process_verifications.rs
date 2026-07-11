use crate::engine;
use crate::model::embeddings::ScanOutcome;
use crate::model::sessions::SessionStatus;
use crate::{RuntimeState, mutate_state, read_state};
use ic_cdk_timers::TimerId;
use personhood_verifier_canister::{HeadPose, VerificationFailureReason, VerificationRetryReason};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
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
    // One heavy step per timer execution (DTS budgeting): with the real
    // pipeline that is one frame (decode + detect + maybe embed, ~10B
    // instructions with SIMD) or the finalize scan; the stub does the whole
    // verification in one step.
    match mutate_state(process_one_step) {
        StepOutcome::Done(Some(verified)) => ic_cdk::futures::spawn(notify_user_index(
            verified.user_index_canister_id,
            verified.user_id,
            verified.model_version,
        )),
        StepOutcome::Done(None) => {}
        // Fail closed: models are committed but the engines can't be built.
        // Never degrade to the stub - keep the queue parked and retry.
        StepOutcome::EnginesUnavailable => {
            let timer_id = ic_cdk_timers::set_timer(Duration::from_secs(10), run);
            TIMER_ID.set(Some(timer_id));
            return;
        }
    }
    read_state(start_job_if_required);
}

struct Verified {
    user_id: UserId,
    model_version: u16,
    user_index_canister_id: CanisterId,
}

enum StepOutcome {
    Done(Option<Verified>),
    EnginesUnavailable,
}

fn process_one_step(state: &mut RuntimeState) -> StepOutcome {
    let Some(session_id) = state.data.processing_queue.front().copied() else {
        return StepOutcome::Done(None);
    };

    let use_real_engine = state.data.models.all_committed();
    // Fail closed: the stub only ever runs in test_mode. In production without
    // committed models, park the queue rather than mint a stub proof
    // (start_verification also refuses to open sessions in this state).
    if !use_real_engine && !state.data.test_mode {
        return StepOutcome::EnginesUnavailable;
    }
    if use_real_engine && !engine::real::engines_ready() {
        // Engines are rebuilt lazily after an upgrade (~2B instructions)
        if let Err(error) = engine::real::build_engines(&state.data.models) {
            error!(%error, "Failed to build inference engines");
            return StepOutcome::EnginesUnavailable;
        }
    }

    let now = state.env.now();
    let Some(session) = state.data.sessions.get_mut(session_id) else {
        state.data.processing_queue.pop_front();
        return StepOutcome::Done(None);
    };
    if session.status.is_terminal() {
        state.data.processing_queue.pop_front();
        return StepOutcome::Done(None);
    }
    if session.deadline <= now && !matches!(session.status, SessionStatus::Processing) {
        session.status = SessionStatus::Failed {
            reason: VerificationFailureReason::SessionExpired,
        };
        state.data.processing_queue.pop_front();
        return StepOutcome::Done(None);
    }
    session.status = SessionStatus::Processing;

    if !use_real_engine {
        let result = process_with_stub(state, session_id);
        state.data.processing_queue.pop_front();
        return StepOutcome::Done(result);
    }

    let session = state.data.sessions.get_mut(session_id).expect("session exists");
    let frame_index = session.next_frame as usize;
    if frame_index < session.challenge.len() {
        // Process exactly one frame, dropping it immediately afterwards
        let step = session.challenge[frame_index];
        let frame = session.frames[frame_index].take();
        session.next_frame += 1;
        let baseline = session.pose_baseline;
        let test_mode = state.data.test_mode;
        match process_frame(frame.as_ref().map(|b| b.as_ref()), step, baseline, test_mode) {
            Ok(outcome) => {
                if session.pose_baseline.is_none() {
                    session.pose_baseline = Some(outcome.pose);
                }
                if let Some(embedding) = outcome.embedding {
                    session.frame_embeddings.push(embedding);
                }
            }
            Err(reason) => {
                session.status = SessionStatus::Failed { reason };
                session.drop_frames();
                session.frame_embeddings.clear();
                state.data.processing_queue.pop_front();
            }
        }
        StepOutcome::Done(None)
    } else {
        let result = finalize(state, session_id);
        state.data.processing_queue.pop_front();
        StepOutcome::Done(result)
    }
}

struct FrameOutcome {
    pose: (f32, f32),
    embedding: Option<Vec<f32>>,
}

fn process_frame(
    frame: Option<&[u8]>,
    step: HeadPose,
    baseline: Option<(f32, f32)>,
    test_mode: bool,
) -> Result<FrameOutcome, VerificationFailureReason> {
    let bytes = frame.ok_or(VerificationFailureReason::ChallengeFailed)?;
    let t0 = ic_cdk::api::instruction_counter();
    let image = engine::real::decode_jpeg(bytes)?;
    let t_decode = ic_cdk::api::instruction_counter();
    let face = engine::real::detect_face(&image)?;
    let t_detect = ic_cdk::api::instruction_counter();
    let (yaw, pitch) = engine::real::estimate_pose(&face);
    // The first frame (always Center) anchors the session's neutral pose;
    // later steps are classified by their delta from it
    let matched = match baseline {
        None => matches!(step, HeadPose::Center) && engine::real::neutral_plausible(yaw, pitch),
        Some((base_yaw, base_pitch)) => engine::real::pose_delta_matches(step, yaw - base_yaw, pitch - base_pitch),
    };
    if test_mode {
        // Pose telemetry for threshold calibration - test environments only
        let (delta_yaw, delta_pitch) = baseline.map_or((0.0, 0.0), |(by, bp)| (yaw - by, pitch - bp));
        info!(?step, yaw, pitch, delta_yaw, delta_pitch, matched, "Pose check");
    }
    if !matched {
        return Err(VerificationFailureReason::ChallengeFailed);
    }
    let (embedding, t_embed) = if matches!(step, HeadPose::Center) {
        let emb = engine::real::embed_face(&image, &face)?;
        (Some(emb), ic_cdk::api::instruction_counter())
    } else {
        (None, t_detect)
    };
    if test_mode {
        // Per-stage instruction cost for the r50 embed measurement (issue
        // #9072): the Center frame (decode + detect + embed) is the heaviest
        // timer step and must stay under the 40B DTS ceiling.
        info!(
            ?step,
            decode = t_decode - t0,
            detect = t_detect - t_decode,
            embed = t_embed.saturating_sub(t_detect),
            total = ic_cdk::api::instruction_counter() - t0,
            "Frame instruction cost"
        );
    }
    Ok(FrameOutcome {
        pose: (yaw, pitch),
        embedding,
    })
}

fn finalize(state: &mut RuntimeState, session_id: u128) -> Option<Verified> {
    let now = state.env.now();
    let model_version = state.data.current_model_version;
    let session = state.data.sessions.get_mut(session_id).expect("session exists");

    let embeddings = std::mem::take(&mut session.frame_embeddings);
    if embeddings.len() < 2 {
        session.status = SessionStatus::Failed {
            reason: VerificationFailureReason::ChallengeFailed,
        };
        return None;
    }
    // All of the session's own faces must agree with each other
    for i in 0..embeddings.len() {
        for j in (i + 1)..embeddings.len() {
            if engine::real::cosine_f32(&embeddings[i], &embeddings[j]) < engine::SAME_FACE_THRESHOLD {
                session.status = SessionStatus::Failed {
                    reason: VerificationFailureReason::ChallengeFailed,
                };
                return None;
            }
        }
    }
    let dim = embeddings[0].len();
    let mut mean = vec![0f32; dim];
    for e in &embeddings {
        for (m, x) in mean.iter_mut().zip(e) {
            *m += x;
        }
    }
    let mean = engine::real::l2_normalize(mean);
    let probe = engine::real::quantize_i8(&mean);

    let user_id = session.user_id;
    let is_retry_round = session.is_retry_round;
    apply_scan_outcome(state, session_id, user_id, is_retry_round, probe, model_version, now)
}

fn process_with_stub(state: &mut RuntimeState, session_id: u128) -> Option<Verified> {
    let now = state.env.now();
    let model_version = state.data.current_model_version;
    let session = state.data.sessions.get_mut(session_id).expect("session exists");

    let frames: Vec<_> = session.frames.iter().flatten().cloned().collect();
    let result = engine::compute_embedding(&frames);
    // Privacy invariant: raw frames are dropped as soon as the embedding
    // (or a failure) has been computed
    session.drop_frames();

    let user_id = session.user_id;
    let is_retry_round = session.is_retry_round;

    let probe = match result {
        Ok(embedding) => embedding,
        Err(reason) => {
            session.status = SessionStatus::Failed { reason };
            return None;
        }
    };
    apply_scan_outcome(state, session_id, user_id, is_retry_round, probe, model_version, now)
}

fn apply_scan_outcome(
    state: &mut RuntimeState,
    session_id: u128,
    user_id: UserId,
    is_retry_round: bool,
    probe: Vec<i8>,
    model_version: u16,
    now: types::TimestampMillis,
) -> Option<Verified> {
    let thresholds = state.data.uniqueness_thresholds;
    let duplicate_threshold = if is_retry_round { thresholds.duplicate_retry } else { thresholds.duplicate };
    let (outcome, max_similarity) =
        state
            .data
            .embeddings
            .scan(model_version, &probe, &user_id, duplicate_threshold, thresholds.clear);
    if state.data.test_mode {
        // Similarity telemetry for threshold calibration - test envs only
        info!(max_similarity, is_retry_round, "Uniqueness scan");
    }

    let session = state.data.sessions.get_mut(session_id).expect("session exists");
    match outcome {
        ScanOutcome::Unique => {
            state.data.embeddings.insert(model_version, user_id, probe);
            // Durably record the pending proof notification before the async
            // c2c so a failed delivery is retried rather than lost
            state.data.pending_verified_notifications.insert(user_id, model_version);
            session.status = SessionStatus::Verified { model_version };
            info!(%user_id, "Personhood verified");
            Some(Verified {
                user_id,
                model_version,
                user_index_canister_id: state.data.user_index_canister_id,
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

pub(crate) async fn notify_user_index(user_index_canister_id: CanisterId, user_id: UserId, model_version: u16) {
    let args = user_index_canister::c2c_notify_personhood_verified::Args { user_id, model_version };
    match user_index_canister_c2c_client::c2c_notify_personhood_verified(user_index_canister_id, &args).await {
        Ok(_) => {
            // Acknowledged - drop it from the durable retry set
            mutate_state(|state| state.data.pending_verified_notifications.remove(&user_id));
        }
        Err(err) => {
            // Left in pending_verified_notifications; prune_sessions retries it
            error!(?err, %user_id, "Failed to notify user_index of verified personhood");
        }
    }
}
