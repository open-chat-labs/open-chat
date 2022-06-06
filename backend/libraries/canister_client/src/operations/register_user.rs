use crate::utils::{build_ic_agent, build_identity};
use crate::{TestIdentity, USER1_DEFAULT_NAME, USER2_DEFAULT_NAME, USER3_DEFAULT_NAME};
use types::{CanisterId, ChallengeAttempt, UserId};

pub async fn register_user(
    url: String,
    user_identity: TestIdentity,
    username: String,
    user_index_canister_id: CanisterId,
    referred_by: Option<UserId>,
) -> UserId {
    let identity = build_identity(user_identity);
    let agent = build_ic_agent(url, identity).await;

    let register_user_args = user_index_canister::register_user::Args {
        username,
        challenge_attempt: ChallengeAttempt {
            key: 0,
            chars: "TEST".to_owned(),
        },
        referred_by,
    };

    match user_index_canister_client::register_user(&agent, &user_index_canister_id, &register_user_args)
        .await
        .unwrap()
    {
        user_index_canister::register_user::Response::Success(user_id) => user_id,
        response => panic!("{response:?}"),
    }
}

pub async fn register_default_user(url: String, user_index_canister_id: CanisterId) -> UserId {
    register_user(
        url,
        TestIdentity::User1,
        USER1_DEFAULT_NAME.to_string(),
        user_index_canister_id,
        None,
    )
    .await
}

pub async fn register_2_default_users(url: String, user_index_canister_id: CanisterId) -> (UserId, UserId) {
    futures::future::join(
        register_user(
            url.clone(),
            TestIdentity::User1,
            USER1_DEFAULT_NAME.to_string(),
            user_index_canister_id,
            None,
        ),
        register_user(
            url.clone(),
            TestIdentity::User2,
            USER2_DEFAULT_NAME.to_string(),
            user_index_canister_id,
            None,
        ),
    )
    .await
}

pub async fn register_3_default_users(url: String, user_index_canister_id: CanisterId) -> (UserId, UserId, UserId) {
    futures::future::join3(
        register_user(
            url.clone(),
            TestIdentity::User1,
            USER1_DEFAULT_NAME.to_string(),
            user_index_canister_id,
            None,
        ),
        register_user(
            url.clone(),
            TestIdentity::User2,
            USER2_DEFAULT_NAME.to_string(),
            user_index_canister_id,
            None,
        ),
        register_user(
            url.clone(),
            TestIdentity::User3,
            USER3_DEFAULT_NAME.to_string(),
            user_index_canister_id,
            None,
        ),
    )
    .await
}
