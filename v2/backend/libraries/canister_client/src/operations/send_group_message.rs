use crate::canisters::*;
use ic_agent::Agent;
use types::GroupChatId;

pub async fn send_group_message(
    agent: &Agent,
    group_chat_id: GroupChatId,
    args: &group_canister::send_message::Args,
) -> group_canister::send_message::SuccessResult {
    match group::send_message(agent, &group_chat_id.into(), args).await {
        group_canister::send_message::Response::Success(r) => r,
        response => panic!("Send group message returned an error: {:?}", response),
    }
}
