use ic_agent::Agent;
use types::UserId;

pub async fn join_group(agent: &Agent, user_id: UserId, args: &user_canister::join_group_v2::Args) {
    let join_group_response = user_canister_client::join_group_v2(agent, &user_id.into(), args)
        .await
        .unwrap();

    if !matches!(join_group_response, user_canister::join_group_v2::Response::Success(_)) {
        panic!("Join group returned an error: {join_group_response:?}");
    }
}
