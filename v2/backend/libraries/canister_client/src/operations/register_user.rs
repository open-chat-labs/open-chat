use crate::canisters::*;
use crate::utils::{build_ic_agent, build_identity};
use crate::TestIdentity;
use types::{CanisterId, UserId};

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
        phone_number: user_index_canister::submit_phone_number::UnvalidatedPhoneNumber {
            country_code: 44,
            number: format!("0711100000{}", phone_number_suffix),
        },
    };

    let submit_phone_number_response =
        user_index::submit_phone_number(&agent, &user_index_canister_id, &submit_phone_number_args).await;

    assert!(matches!(
        submit_phone_number_response,
        user_index_canister::submit_phone_number::Response::Success
    ));

    let confirm_phone_number_args = user_index_canister::confirm_phone_number::Args {
        confirmation_code: "123456".to_string(),
    };

    let confirm_phone_number_response =
        user_index::confirm_phone_number(&agent, &user_index_canister_id, &confirm_phone_number_args).await;

    assert!(matches!(
        confirm_phone_number_response,
        user_index_canister::confirm_phone_number::Response::Success
    ));

    let create_canister_args = user_index_canister::create_canister::Args {};

    let create_canister_response = user_index::create_canister(&agent, &user_index_canister_id, &create_canister_args).await;

    if let user_index_canister::create_canister::Response::Success(user_canister_id) = create_canister_response {
        if let Some(username) = username {
            super::set_username::set_username(&agent, username, user_index_canister_id).await;
        }
        user_canister_id.into()
    } else {
        panic!("{:?}", create_canister_response);
    }
}