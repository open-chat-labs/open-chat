use crate::domain::user_store::TransferCyclesResponse;
use crate::domain::user_store::UserStore;
use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;

pub fn update(request: Request) -> TransferCyclesResponse {
    let user_store: &mut UserStore = storage::get_mut();

    user_store.transfer_cycles(&request.sender, &request.recipient, request.amount)
}

#[derive(Deserialize)]
pub struct Request {
    sender: UserId,
    recipient: UserId,
    amount: u128,
}
