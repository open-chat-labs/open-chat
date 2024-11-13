use crate::client::ledger;
use crate::env::ENV;
use crate::setup::install_icrc_ledger;
use crate::utils::now_millis;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use registry_canister::TokenStandard;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_principal, random_string};
use types::{CanisterId, Cryptocurrency};

#[test]
fn add_token_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let info_url = "info".to_string();
    let how_to_buy_url = "how to buy".to_string();
    let transaction_url_format = "transaction format".to_string();
    let logo = "logo".to_string();

    let add_token_response = client::registry::add_token(
        env,
        *controller,
        canister_ids.registry,
        &registry_canister::add_token::Args {
            ledger_canister_id: test_data.ledger_canister_id,
            payer: Some(test_data.user.user_id),
            token_standard: TokenStandard::ICRC1,
            info_url: info_url.clone(),
            how_to_buy_url: how_to_buy_url.clone(),
            transaction_url_format: transaction_url_format.clone(),
            logo: Some(logo.clone()),
        },
    );

    match add_token_response {
        registry_canister::add_token::Response::Success => (),
        response => panic!("'add_token' error: {response:?}"),
    };

    env.tick();

    let now = now_millis(env);

    let updates_response1 = client::registry::updates(
        env,
        random_principal(),
        canister_ids.registry,
        &registry_canister::updates::Args { since: Some(now - 1) },
    );

    if let registry_canister::updates::Response::Success(result) = updates_response1 {
        assert_eq!(result.last_updated, now);

        let token_details = result.token_details.unwrap();
        let token = token_details
            .iter()
            .find(|t| t.ledger_canister_id == test_data.ledger_canister_id)
            .unwrap();

        assert_eq!(token.name, "ABC Token");
        assert_eq!(token.symbol, "ABC");
        assert_eq!(token.decimals, 8);
        assert_eq!(token.fee, 10_000);
        assert_eq!(token.info_url, info_url);
        assert_eq!(token.how_to_buy_url, how_to_buy_url);
        assert_eq!(token.transaction_url_format, transaction_url_format);
        assert_eq!(token.logo, logo);
        assert_eq!(token.last_updated, now);
    } else {
        panic!()
    }

    let updates_response2 = client::registry::updates(
        env,
        random_principal(),
        canister_ids.registry,
        &registry_canister::updates::Args { since: Some(now) },
    );

    assert!(matches!(
        updates_response2,
        registry_canister::updates::Response::SuccessNoUpdates
    ));
}

#[test]
fn update_token_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);

    let info_url = "info".to_string();
    let how_to_buy_url = "how to buy".to_string();
    let transaction_url_format = "transaction format".to_string();
    let logo = "logo".to_string();

    client::registry::add_token(
        env,
        *controller,
        canister_ids.registry,
        &registry_canister::add_token::Args {
            ledger_canister_id: test_data.ledger_canister_id,
            payer: Some(test_data.user.user_id),
            token_standard: TokenStandard::ICRC1,
            info_url: info_url.clone(),
            how_to_buy_url: how_to_buy_url.clone(),
            transaction_url_format: transaction_url_format.clone(),
            logo: Some(logo.clone()),
        },
    );

    env.tick();
    env.advance_time(Duration::from_secs(1));
    let new_name = random_string();

    let update_token_response = client::registry::update_token(
        env,
        *controller,
        canister_ids.registry,
        &registry_canister::update_token::Args {
            ledger_canister_id: test_data.ledger_canister_id,
            name: Some(new_name.clone()),
            symbol: None,
            info_url: None,
            how_to_buy_url: None,
            transaction_url_format: None,
            logo: None,
            fee: None,
        },
    );

    assert!(matches!(
        update_token_response,
        registry_canister::update_token::Response::Success
    ));

    env.tick();
    let now = now_millis(env);

    let updates_response = client::registry::updates(
        env,
        random_principal(),
        canister_ids.registry,
        &registry_canister::updates::Args { since: Some(now - 1) },
    );

    if let registry_canister::updates::Response::Success(result) = updates_response {
        assert_eq!(result.last_updated, now);

        let token_details = result.token_details.unwrap();
        let token = token_details
            .iter()
            .find(|t| t.ledger_canister_id == test_data.ledger_canister_id)
            .unwrap();

        assert_eq!(token.name, new_name);
        assert_eq!(token.last_updated, now);
    } else {
        panic!()
    }
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let ledger_canister_id = install_icrc_ledger(
        env,
        controller,
        "ABC Token".to_string(),
        "ABC".to_string(),
        10_000,
        None,
        Vec::new(),
    );

    env.advance_time(Duration::from_secs(1));

    // Register user and give them enough CHAT for the token listing fee (1 CHAT in test)
    let user = client::register_user(env, canister_ids);
    ledger::happy_path::transfer(env, controller, canister_ids.chat_ledger, user.user_id, 110_000_000);

    // Approve the token listing fee payment (BURN)
    client::user::happy_path::approve_transfer(
        env,
        &user,
        &user_canister::approve_transfer::Args {
            spender: canister_ids.registry.into(),
            ledger_canister_id: Cryptocurrency::CHAT.ledger_canister_id().unwrap(),
            amount: 100_000_000 + Cryptocurrency::CHAT.fee().unwrap(),
            expires_in: None,
            pin: None,
        },
    );

    TestData {
        user,
        ledger_canister_id,
    }
}

struct TestData {
    user: User,
    ledger_canister_id: CanisterId,
}
