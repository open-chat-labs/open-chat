use crate::role::Role;
use crate::{EventIndex, MessageIndex, UserId};
use crate::{TimestampMillis, Updatable};
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
    pub read_up_to: Updatable<MessageIndex>,
    pub mute_notifications: bool,
    pub min_visible_event_index: EventIndex,
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

impl From<&ParticipantInternal> for Participant {
    fn from(p: &ParticipantInternal) -> Self {
        Participant {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}
