use ic_cdk::export::candid::CandidType;
use ic_cdk::export::Principal;
use serde::Deserialize;
use shared::user_id::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Request {
    pub sender: UserId,
    pub recipient: UserId,
    pub amount: u128,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Result),
    UserNotFound,
    RecipientNotFound,
    BalanceExceeded,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Result {
    new_balance: u128,
}

pub async fn update(request: Request) -> Response {
    let user_mgmt_id = Principal::from_text("7n5dj-xaaaa-aaaaf-aaacq-cai").unwrap();

    let (response,): (Response,) = ic_cdk::call(user_mgmt_id, "transfer_cycles", (request,))
        .await
        .unwrap();

    response
}
