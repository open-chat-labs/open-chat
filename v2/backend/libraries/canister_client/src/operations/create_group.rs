use crate::canisters::*;
use ic_agent::Agent;
use types::{GroupChatId, UserId};

pub async fn create_group(
    agent: &Agent,
    creator_id: UserId,
    args: &user_canister::create_group::Args,
    participants: Vec<UserId>,
) -> GroupChatId {
    let create_group_response = user::create_group(agent, &creator_id.into(), args).await;

    if let user_canister::create_group::Response::Success(r) = create_group_response {
        let add_participants_args = group_canister::add_participants::Args { user_ids: participants };
        let add_participants_response = group::add_participants(agent, &r.group_chat_id.into(), &add_participants_args).await;
        if !matches!(add_participants_response, group_canister::add_participants::Response::Success) {
            panic!("Add participants returned an error: {:?}", add_participants_response);
        }

        r.group_chat_id
    } else {
        panic!("Create group returned an error: {:?}", create_group_response);
    }
}