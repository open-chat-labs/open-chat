use crate::env::ENV;
use crate::{TestEnv, client};
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use multi_user_canister::NamedAccount;
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use testing::rng::{random_principal, random_string};

#[test]
fn save_and_delete_crypto_account_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let name = random_string();
    let account = random_principal().to_string();

    client::user::happy_path::save_crypto_account(env, &user, &name, &account);

    let accounts = client::user::happy_path::saved_crypto_accounts(env, &user);

    assert_eq!(
        accounts,
        vec![NamedAccount {
            name: name.clone(),
            account
        }]
    );

    client::user::happy_path::delete_saved_crypto_account(env, &user, name);

    assert!(client::user::happy_path::saved_crypto_accounts(env, &user).is_empty());
}

#[test]
fn save_crypto_account_accepts_an_address_on_each_network() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let accounts: Vec<_> = [
        ("icrc", random_principal().to_string()),
        (
            "icp",
            AccountIdentifier::new(&random_principal(), &DEFAULT_SUBACCOUNT).to_hex(),
        ),
        ("btc", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq".to_string()),
        ("eth", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed".to_string()),
        ("sol", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM".to_string()),
    ]
    .into_iter()
    .map(|(name, account)| NamedAccount {
        name: name.to_string(),
        account,
    })
    .collect();

    for account in &accounts {
        client::user::happy_path::save_crypto_account(env, &user, &account.name, &account.account);
    }

    assert_eq!(client::user::happy_path::saved_crypto_accounts(env, &user), accounts);
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
        matches!(response, multi_user_canister::save_crypto_account::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest))
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
    assert!(matches!(
        response,
        multi_user_canister::save_crypto_account::Response::Success
    ));

    let named_account2 = NamedAccount { name, account: account2 };

    let response = client::user::save_crypto_account(env, user.principal, user.canister(), &named_account2);
    assert!(
        matches!(response, multi_user_canister::save_crypto_account::Response::Error(e) if e.matches_code(OCErrorCode::NameTaken))
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

    client::user::happy_path::save_crypto_account(env, &user, name1, &account);
    client::user::happy_path::save_crypto_account(env, &user, &name2, &account);

    let accounts = client::user::happy_path::saved_crypto_accounts(env, &user);

    assert_eq!(accounts, vec![NamedAccount { name: name2, account }]);
}
