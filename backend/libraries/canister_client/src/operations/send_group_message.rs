use ic_agent::Agent;
use types::ChatId;

pub async fn send_group_message(
    agent: &Agent,
    chat_id: ChatId,
    args: &group_canister::send_message::Args,
) -> group_canister::send_message::SuccessResult {
    match group_canister_client::send_message(agent, &chat_id.into(), args)
        .await
        .unwrap()
    {
        group_canister::send_message::Response::Success(r) => r,
        response => panic!("Send group message returned an error: {response:?}"),
    }
}
