use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ConnectionDetails {
    Offer(Offer),
    Answer(Answer),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Offer {
    pub id: String,
    pub from: UserId,
    pub connection_string: String,
    pub ice_candidates: Vec<String>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Answer {
    pub id: String,
    pub offer_id: String,
    pub from: UserId,
    pub connection_string: String,
    pub ice_candidates: Vec<String>,
    pub timestamp: TimestampMillis,
}

impl ConnectionDetails {
    pub fn get_id(&self) -> &str {
        match self {
            ConnectionDetails::Offer(o) => &o.id,
            ConnectionDetails::Answer(a) => &a.id,
        }
    }

    pub fn get_from_user(&self) -> &UserId {
        match self {
            ConnectionDetails::Offer(o) => &o.from,
            ConnectionDetails::Answer(a) => &a.from,
        }
    }

    pub fn get_timestamp(&self) -> TimestampMillis {
        match self {
            ConnectionDetails::Offer(o) => o.timestamp,
            ConnectionDetails::Answer(a) => a.timestamp,
        }
    }
}
