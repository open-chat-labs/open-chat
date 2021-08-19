use self::Response::*;
use crate::domain::connection_details::{AllConnectionDetails, ConnectionDetailsSummary};
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::timestamp::Timestamp;

pub fn query(updated_since: Option<Timestamp>) -> Response {
    let me = shared::user_id::get_current();
    let now = shared::timestamp::now();
    let connection_details: &AllConnectionDetails = storage::get();

    let connections = connection_details.get_connection_details(&me, updated_since, now);

    let result = Result {
        connections,
        timestamp: now,
    };

    Success(result)
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    connections: Vec<ConnectionDetailsSummary>,
    timestamp: Timestamp,
}
