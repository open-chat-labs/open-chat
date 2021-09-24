use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum SessionDetails {
    Offer(Offer),
    Answer(Answer),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Offer {
    pub user_id: UserId,
    pub endpoint: Endpoint,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Answer {
    pub user_id: UserId,
    pub offer_id: String,
    pub endpoint: Endpoint,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Endpoint {
    pub id: String,
    pub connection_string: String,
    pub ice_candidates: Vec<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SessionDetailsEvent {
    pub session_details: SessionDetails,
    pub timestamp: TimestampMillis,
}

impl SessionDetails {
    pub fn id(&self) -> &str {
        match self {
            SessionDetails::Offer(o) => &o.endpoint.id,
            SessionDetails::Answer(a) => &a.endpoint.id,
        }
    }

    pub fn user_id(&self) -> UserId {
        match self {
            SessionDetails::Offer(o) => o.user_id,
            SessionDetails::Answer(a) => a.user_id,
        }
    }
}
