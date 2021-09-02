use ic_agent::Agent;
use types::{CanisterId, UserId, UserSummary};

pub async fn get_user(
    agent: &Agent,
    user_id: Option<UserId>,
    username: Option<String>,
    user_index_canister_id: CanisterId,
) -> Option<UserSummary> {
    let args = user_index_canister::user::Args { user_id, username };
    match user_index_canister_client::user(agent, &user_index_canister_id, &args).await {
        user_index_canister::user::Response::Success(r) => Some(r),
        _ => None,
    }
}
