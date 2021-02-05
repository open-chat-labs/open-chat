use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;
use crate::domain::user_store::TransferCyclesResponse;
use crate::domain::user_store::UserStore;

pub fn update(request: Request) -> TransferCyclesResponse {
    let me = shared::user_id::get_current();

    let user_store: &mut UserStore = storage::get_mut();

    user_store.transfer_cycles(
        &me, 
        &request.recipient, 
        request.amount)
}

#[derive(Deserialize)]
pub struct Request {
    recipient: UserId,
    amount: u128
}
