use crate::client::register_user_and_include_auth;
use crate::env::ENV;
use crate::utils::now_millis;
use crate::{TestEnv, client};
use identity_canister::create_account_linking_code::Response as CreateAccountLinkingCodeResponse;
use identity_canister::link_with_account_linking_code::Response as LinkWithAccountLinkingCodeResponse;
use std::ops::Deref;
use testing::rng::random_delegated_principal;

#[test]
fn test_account_linking_create_link_code() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    // Original user that will create the linking code
    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    //
    // ---- Create a linking code ----
    //
    let create_linking_code_response = client::identity::create_account_linking_code(
        env,
        user_auth.auth_principal,
        canister_ids.identity,
        &identity_canister::create_account_linking_code::Args {},
    );

    let created_linking_code = match create_linking_code_response {
        CreateAccountLinkingCodeResponse::Success(code) => code,
        response => panic!("'create_account_linking_code' error: {response:?}"),
    };

    assert!(created_linking_code.value.len() == 6);
    assert!(created_linking_code.is_valid(now_millis(env)));
    assert_eq!(created_linking_code.user_id, user.user_id);

    //
    // ---- Fetch the linking code again to ensure it's the same ----
    //

    let repeated_linking_code_response = client::identity::create_account_linking_code(
        env,
        user_auth.auth_principal,
        canister_ids.identity,
        &identity_canister::create_account_linking_code::Args {},
    );

    match repeated_linking_code_response {
        CreateAccountLinkingCodeResponse::Success(repeated_linking_code) => {
            assert_eq!(repeated_linking_code, created_linking_code)
        }
        response => panic!("'create_account_linking_code' error: {response:?}"),
    };

    //
    // ---- Initialise new identity to link ----
    //
    let (new_principal, new_pub_key) = random_delegated_principal(canister_ids.sign_in_with_email);

    //
    // ---- Link account auth methods using the code ----
    //
    let account_linking_response = client::identity::link_with_account_linking_code(
        env,
        new_principal,
        canister_ids.identity,
        &identity_canister::link_with_account_linking_code::Args {
            code: created_linking_code.value.clone(),
            public_key: new_pub_key,
            webauthn_key: None,
        },
    );

    match account_linking_response {
        LinkWithAccountLinkingCodeResponse::Success => {}
        LinkWithAccountLinkingCodeResponse::Error(err) => panic!("Account linking failed with: {err:#?}"),
    }

    //
    // ---- Verify that the linking is successful by querying for it ----
    //
    let auth_principals_response = client::identity::happy_path::auth_principals(env, new_principal, canister_ids.identity);

    assert_eq!(auth_principals_response.len(), 2);
    assert!(auth_principals_response.first().unwrap().is_ii_principal);
    assert!(!auth_principals_response.last().unwrap().is_ii_principal);
}
