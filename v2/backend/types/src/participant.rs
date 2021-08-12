use crate::role::Role;
use crate::TimestampMillis;
use crate::{MessageIndex, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Participant {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: Role,
}

#[derive(CandidType, Deserialize)]
pub struct ParticipantInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: Role,
    pub read_up_to: MessageIndex,
    pub mute_notifications: bool,
}

impl From<ParticipantInternal> for Participant {
    fn from(p: ParticipantInternal) -> Self {
        Participant {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}
