use personhood_verifier_canister::{HeadPose, VerificationFailureReason, VerificationRetryReason};
use serde_bytes::ByteBuf;
use types::{CanisterId, TimestampMillis, UserId};

// Heap-only by design: raw frames must never reach stable memory or upgrade
// serialization (see the #[serde(skip)] on Data.sessions).
#[derive(Default)]
pub struct Sessions {
    sessions: std::collections::HashMap<u128, VerificationSession>,
}

pub struct VerificationSession {
    pub user_id: UserId,
    pub principal: CanisterId,
    pub challenge: Vec<HeadPose>,
    pub frames: Vec<Option<ByteBuf>>,
    pub total_bytes: u32,
    pub deadline: TimestampMillis,
    pub is_retry_round: bool,
    pub status: SessionStatus,
    // Real-pipeline progress: one frame is fully processed per timer
    // execution (DTS budgeting), then a finalize step
    pub next_frame: u32,
    // f32 embeddings of the Center-pose frames, kept until finalize
    pub frame_embeddings: Vec<Vec<f32>>,
}

#[derive(Clone, Copy, Debug)]
pub enum SessionStatus {
    Open,
    Queued,
    Processing,
    Verified { model_version: u16 },
    RetryRequired { reason: VerificationRetryReason },
    Failed { reason: VerificationFailureReason },
}

impl SessionStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            SessionStatus::Verified { .. } | SessionStatus::RetryRequired { .. } | SessionStatus::Failed { .. }
        )
    }
}

impl VerificationSession {
    pub fn missing_steps(&self) -> Vec<u32> {
        self.frames
            .iter()
            .enumerate()
            .filter(|(_, f)| f.is_none())
            .map(|(i, _)| i as u32)
            .collect()
    }

    pub fn drop_frames(&mut self) {
        for frame in self.frames.iter_mut() {
            *frame = None;
        }
    }
}

impl Sessions {
    pub fn get(&self, session_id: u128) -> Option<&VerificationSession> {
        self.sessions.get(&session_id)
    }

    pub fn get_mut(&mut self, session_id: u128) -> Option<&mut VerificationSession> {
        self.sessions.get_mut(&session_id)
    }

    pub fn insert(&mut self, session_id: u128, session: VerificationSession) {
        self.sessions.insert(session_id, session);
    }

    pub fn active_session_for_user(&self, user_id: &UserId, now: TimestampMillis) -> Option<(u128, &VerificationSession)> {
        self.sessions
            .iter()
            .find(|(_, s)| s.user_id == *user_id && !s.status.is_terminal() && s.deadline > now)
            .map(|(id, s)| (*id, s))
    }

    pub fn remove_for_user(&mut self, user_id: &UserId) {
        self.sessions.retain(|_, s| s.user_id != *user_id);
    }

    pub fn count(&self) -> u64 {
        self.sessions.len() as u64
    }

    // Removes expired sessions; terminal ones are kept until the deadline
    // passes so late status polls still see their result
    pub fn prune_expired(&mut self, now: TimestampMillis, grace: u64) {
        self.sessions.retain(|_, s| s.deadline + grace > now);
    }
}
