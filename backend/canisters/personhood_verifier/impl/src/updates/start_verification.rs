use crate::model::sessions::{SessionStatus, VerificationSession};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use personhood_verifier_canister::start_verification::{Response::*, *};
use personhood_verifier_canister::{HeadPose, VerificationChallenge};
use rand::Rng;
use rand::seq::SliceRandom;
use types::UserId;
use user_index_canister_c2c_client::lookup_user;

const SESSION_TTL: u64 = 2 * MINUTE_IN_MS;
const MAX_FRAME_BYTES: u32 = 500 * 1024;
const MAX_TOTAL_BYTES: u32 = 3 * 1024 * 1024;
const MAX_OPEN_SESSIONS: u64 = 500;

#[update(msgpack = true)]
#[trace]
async fn start_verification(_args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    // Sessions are only issued to registered OpenChat users
    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) => user.user_id,
        Ok(None) => return UserNotFound,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    mutate_state(|state| start_verification_impl(user_id, state))
}

fn start_verification_impl(user_id: UserId, state: &mut RuntimeState) -> Response {
    // Production must never run the deterministic stub engine (which grants a
    // unique proof to any capture): if the real models are not committed, no
    // verification can start. The stub path is reserved for test_mode.
    if !state.data.test_mode && !state.data.models.all_committed() {
        return NotReady;
    }

    let now = state.env.now();
    state.data.sessions.prune_expired(now, MINUTE_IN_MS);

    if state.data.embeddings.contains(state.data.current_model_version, &user_id) {
        return AlreadyVerified;
    }

    if let Some((session_id, session)) = state.data.sessions.active_session_for_user(&user_id, now) {
        return SessionAlreadyActive(challenge_details(session_id, session));
    }

    if state.data.sessions.count() >= MAX_OPEN_SESSIONS {
        return Busy;
    }

    let attempts = state.data.attempts.entry(user_id).or_default();
    attempts.prune(now);
    let is_retry_round = attempts.retry_round_available(now);
    if !is_retry_round {
        if attempts.attempts_remaining(now) == 0 {
            return AttemptLimitReached {
                next_attempt_at: attempts.next_attempt_at(now),
            };
        }
        attempts.record_attempt(now);
    } else {
        attempts.retry_permitted_until = None;
    }

    let rng = state.env.rng();
    let session_id: u128 = rng.r#gen();
    let mut middle = vec![HeadPose::Left, HeadPose::Right, HeadPose::Up, HeadPose::Down];
    middle.shuffle(rng);
    // The retry round uses a longer challenge
    middle.truncate(if is_retry_round { 4 } else { 3 });

    let mut challenge = vec![HeadPose::Center];
    challenge.extend(middle);
    challenge.push(HeadPose::Center);

    let session = VerificationSession {
        user_id,
        principal: state.env.caller(),
        challenge: challenge.clone(),
        frames: vec![None; challenge.len()],
        total_bytes: 0,
        deadline: now + SESSION_TTL,
        is_retry_round,
        status: SessionStatus::Open,
        next_frame: 0,
        pose_baseline: None,
        frame_embeddings: Vec::new(),
    };
    let details = challenge_details(session_id, &session);
    state.data.sessions.insert(session_id, session);

    Success(details)
}

fn challenge_details(session_id: u128, session: &VerificationSession) -> VerificationChallenge {
    VerificationChallenge {
        session_id,
        challenge: session.challenge.clone(),
        max_frames: session.challenge.len() as u32,
        max_frame_bytes: MAX_FRAME_BYTES,
        max_total_bytes: MAX_TOTAL_BYTES,
        deadline: session.deadline,
        is_retry_round: session.is_retry_round,
    }
}

pub(crate) const fn max_frame_bytes() -> u32 {
    MAX_FRAME_BYTES
}

pub(crate) const fn max_total_bytes() -> u32 {
    MAX_TOTAL_BYTES
}
