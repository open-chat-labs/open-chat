use crate::env::ENV;
use crate::rng::{random_principal, random_string};
use crate::{client, TestEnv};
use std::ops::Deref;
use types::Empty;
use user_canister::NamedAccount;

#[test]
fn save_crypto_account_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let name = random_string();
    let account = random_principal().to_string();

    let named_account = NamedAccount { name, account };

    let response = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account);
    assert!(matches!(response, user_canister::save_crypto_account::Response::Success));

    let user_canister::saved_crypto_accounts::Response::Success(accounts) =
        client::user::saved_crypto_accounts(env, user.principal, user.canister(), &Empty {});

    assert_eq!(accounts, vec![named_account]);
}
