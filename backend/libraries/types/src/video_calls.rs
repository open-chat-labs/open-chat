use crate::{CallParticipant, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub enum VideoCallPresence {
    #[default]
    Default,
    Owner,
    Hidden,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct VideoCallParticipants {
    pub participants: Vec<CallParticipant>,
    pub hidden: Vec<CallParticipant>,
    pub last_updated: TimestampMillis,
}
