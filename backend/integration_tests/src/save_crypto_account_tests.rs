use crate::env::ENV;
use crate::{client, TestEnv};
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use testing::rng::{random_principal, random_string};
use types::Empty;
use user_canister::NamedAccount;

#[test]
fn save_crypto_account_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let name = random_string();
    let account = random_principal().to_string();

    let named_account = NamedAccount { name, account };

    let response = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account);
    assert!(matches!(response, user_canister::save_crypto_account::Response::Success));

    let user_canister::saved_crypto_accounts::Response::Success(accounts) =
        client::user::saved_crypto_accounts(env, user.principal, user.canister(), &Empty {});

    assert_eq!(accounts, vec![named_account]);
}

#[test]
fn save_crypto_account_invalid() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let name = random_string();
    let account = random_string();

    let named_account = NamedAccount { name, account };

    let response = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account);
    assert!(
        matches!(response, user_canister::save_crypto_account::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest))
    );
}

#[test]
fn save_crypto_account_name_taken() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let name = random_string();
    let account1 = random_principal().to_string();
    let account2 = random_principal().to_string();

    let named_account1 = NamedAccount {
        name: name.clone(),
        account: account1,
    };

    let response = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account1);
    assert!(matches!(response, user_canister::save_crypto_account::Response::Success));

    let named_account2 = NamedAccount { name, account: account2 };

    let response = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account2);
    assert!(
        matches!(response, user_canister::save_crypto_account::Response::Error(e) if e.matches_code(OCErrorCode::NameTaken))
    );
}

#[test]
fn save_crypto_account_with_same_account_updates_name() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let name1 = random_string();
    let name2 = random_string();
    let account = random_principal().to_string();

    let named_account1 = NamedAccount {
        name: name1,
        account: account.clone(),
    };

    let response1 = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account1);
    assert!(matches!(response1, user_canister::save_crypto_account::Response::Success));

    let named_account2 = NamedAccount {
        name: name2.clone(),
        account,
    };

    let response2 = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account2);
    assert!(matches!(response2, user_canister::save_crypto_account::Response::Success));

    let user_canister::saved_crypto_accounts::Response::Success(accounts) =
        client::user::saved_crypto_accounts(env, user.principal, user.canister(), &Empty {});

    assert_eq!(accounts, vec![named_account2]);
}
