use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Endpoint {
    pub id: String,
    pub origin_endpoint_id: Option<String>,
    pub user_id: UserId,
    pub connection_string: String,
    pub ice_candidates: Vec<String>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EndpointEvent {
    pub endpoint: Endpoint,
    pub timestamp: TimestampMillis,
}
