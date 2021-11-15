use ic_agent::Agent;
use types::CanisterId;

pub async fn set_username(agent: &Agent, username: String, user_index_canister_id: CanisterId) {
    let args = user_index_canister::set_username::Args { username };
    let response = user_index_canister_client::set_username(agent, &user_index_canister_id, &args)
        .await
        .unwrap();

    if !matches!(response, user_index_canister::set_username::Response::Success) {
        panic!("{:?}", response);
    }
}
