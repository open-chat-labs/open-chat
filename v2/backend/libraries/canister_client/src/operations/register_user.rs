use crate::utils::{build_ic_agent, build_identity};
use crate::{TestIdentity, USER1_DEFAULT_NAME, USER2_DEFAULT_NAME, USER3_DEFAULT_NAME};
use types::{CanisterId, PhoneNumber, UserId};

pub async fn register_user(
    url: String,
    user_identity: TestIdentity,
    username: Option<String>,
    user_index_canister_id: CanisterId,
) -> UserId {
    let phone_number_suffix = match &user_identity {
        TestIdentity::User1 => "1",
        TestIdentity::User2 => "2",
        TestIdentity::User3 => "3",
        _ => "0",
    };

    let identity = build_identity(user_identity);
    let agent = build_ic_agent(url, identity).await;

    let submit_phone_number_args = user_index_canister::submit_phone_number::Args {
        phone_number: PhoneNumber::new(44, format!("711100000{}", phone_number_suffix)),
    };

    let submit_phone_number_response =
        user_index_canister_client::submit_phone_number(&agent, &user_index_canister_id, &submit_phone_number_args).await;

    assert!(matches!(
        submit_phone_number_response,
        user_index_canister::submit_phone_number::Response::Success
    ));

    let confirm_phone_number_args = user_index_canister::confirm_phone_number::Args {
        confirmation_code: "123456".to_string(),
    };

    let confirm_phone_number_response =
        user_index_canister_client::confirm_phone_number(&agent, &user_index_canister_id, &confirm_phone_number_args).await;

    assert!(matches!(
        confirm_phone_number_response,
        user_index_canister::confirm_phone_number::Response::Success
    ));

    let create_canister_args = user_index_canister::create_canister::Args {};

    let create_canister_response =
        user_index_canister_client::create_canister(&agent, &user_index_canister_id, &create_canister_args).await;

    if let user_index_canister::create_canister::Response::Success(user_canister_id) = create_canister_response {
        if let Some(username) = username {
            super::set_username::set_username(&agent, username, user_index_canister_id).await;
        }
        user_canister_id.into()
    } else {
        panic!("{:?}", create_canister_response);
    }
}

pub async fn register_default_user(url: String, user_index_canister_id: CanisterId) -> UserId {
    register_user(url, TestIdentity::User1, Some(USER1_DEFAULT_NAME.to_string()), user_index_canister_id).await
}

pub async fn register_2_default_users(url: String, user_index_canister_id: CanisterId) -> (UserId, UserId) {
    futures::future::join(
        register_user(
            url.clone(),
            TestIdentity::User1,
            Some(USER1_DEFAULT_NAME.to_string()),
            user_index_canister_id,
        ),
        register_user(
            url.clone(),
            TestIdentity::User2,
            Some(USER2_DEFAULT_NAME.to_string()),
            user_index_canister_id,
        ),
    )
        .await
}

pub async fn register_3_default_users(url: String, user_index_canister_id: CanisterId) -> (UserId, UserId, UserId) {
    futures::future::join3(
        register_user(
            url.clone(),
            TestIdentity::User1,
            Some(USER1_DEFAULT_NAME.to_string()),
            user_index_canister_id,
        ),
        register_user(
            url.clone(),
            TestIdentity::User2,
            Some(USER2_DEFAULT_NAME.to_string()),
            user_index_canister_id,
        ),
        register_user(
            url.clone(),
            TestIdentity::User3,
            Some(USER3_DEFAULT_NAME.to_string()),
            user_index_canister_id,
        ),
    )
        .await
}


