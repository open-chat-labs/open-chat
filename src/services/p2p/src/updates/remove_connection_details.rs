use crate::domain::connection_details::AllConnectionDetails;
use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;

pub fn update(request: Request) -> u32 {
    let me = shared::user_id::get_current();
    let connection_details: &mut AllConnectionDetails = storage::get_mut();

    let mut count_removed = 0;
    for connection in request.connections {
        if connection_details.remove_connection_details(&connection.user_id, &me, &connection.id) {
            count_removed += 1;
        }
    }
    count_removed
}

#[derive(Deserialize)]
pub struct Request {
    connections: Vec<RemoveSingleConnectionRequest>,
}

#[derive(Deserialize)]
pub struct RemoveSingleConnectionRequest {
    user_id: UserId,
    id: String,
}
