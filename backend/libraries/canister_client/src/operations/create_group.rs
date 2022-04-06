use ic_agent::Agent;
use types::{ChatId, UserId};

pub async fn create_group(
    agent: &Agent,
    creator_id: UserId,
    args: &user_canister::create_group::Args,
    participants: Vec<UserId>,
) -> ChatId {
    let create_group_response = user_canister_client::create_group(agent, &creator_id.into(), args)
        .await
        .unwrap();

    if let user_canister::create_group::Response::Success(r) = create_group_response {
        if !participants.is_empty() {
            let add_participants_args = group_canister::add_participants::Args {
                user_ids: participants,
                added_by_name: String::default(),
                allow_blocked_users: false,
            };
            let add_participants_response =
                group_canister_client::add_participants(agent, &r.chat_id.into(), &add_participants_args)
                    .await
                    .unwrap();

            if !matches!(add_participants_response, group_canister::add_participants::Response::Success) {
                panic!("Add participants returned an error: {add_participants_response:?}");
            }
        }

        r.chat_id
    } else {
        panic!("Create group returned an error: {create_group_response:?}");
    }
}
