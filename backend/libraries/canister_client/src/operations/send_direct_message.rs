use ic_agent::Agent;
use types::UserId;

pub async fn send_direct_message(
    agent: &Agent,
    sender: UserId,
    args: &user_canister::send_message::Args,
) -> user_canister::send_message::SuccessResult {
    match user_canister_client::send_message(agent, &sender.into(), args).await.unwrap() {
        user_canister::send_message::Response::Success(r) => r,
        response => panic!("Send direct message returned an error: {response:?}"),
    }
}

pub async fn send_direct_message_with_cryptocurrency_transfer(
    agent: &Agent,
    sender: UserId,
    args: &user_canister::send_message::Args,
) -> user_canister::send_message::TransferSuccessResult {
    match user_canister_client::send_message(agent, &sender.into(), args).await.unwrap() {
        user_canister::send_message::Response::TransferSuccessV2(r) => r,
        response => panic!("Send direct message returned an error: {response:?}"),
    }
}
