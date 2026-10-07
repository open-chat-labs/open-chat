use crate::client::ledger;
use crate::env::ENV;
use crate::setup::install_icrc_ledger;
use crate::utils::{now_millis, set_freezing_threshold, tick_many};
use crate::{CanisterIds, TestEnv, User, client};
use candid::{Nat, Principal};
use constants::{CHAT_LEDGER_CANISTER_ID, CHAT_TRANSFER_FEE, HOUR_IN_MS};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_principal, random_string};
use types::CanisterId;

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
    let transaction_url_format = "transaction format".to_string();

    let add_token_response = client::registry::add_token(
        env,
        *controller,
        canister_ids.registry,
        &registry_canister::add_token::Args {
            ledger_canister_id: test_data.ledger_canister_id,
            payer: Some(test_data.user.user_id),
            info_url: info_url.clone(),
            transaction_url_format: transaction_url_format.clone(),
            one_sec_enabled: None,
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
        assert_eq!(token.transaction_url_format, transaction_url_format);
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
    let transaction_url_format = "transaction format".to_string();

    client::registry::add_token(
        env,
        *controller,
        canister_ids.registry,
        &registry_canister::add_token::Args {
            ledger_canister_id: test_data.ledger_canister_id,
            payer: Some(test_data.user.user_id),
            info_url: info_url.clone(),
            transaction_url_format: transaction_url_format.clone(),
            one_sec_enabled: None,
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
            transaction_url_format: None,
            logo: None,
            fee: None,
            one_sec_enabled: None,
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

// The IC uninstalls a canister once it runs out of cycles, after which calls to it are rejected as it
// being out of cycles rather than as it having no Wasm module
#[test]
fn ledger_uninstalled_after_running_out_of_cycles_is_marked_uninstalled() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let test_data = init_test_data(env, canister_ids, *controller);
    let ledger_canister_id = test_data.ledger_canister_id;

    let add_token_response = client::registry::add_token(
        env,
        *controller,
        canister_ids.registry,
        &registry_canister::add_token::Args {
            ledger_canister_id,
            payer: Some(test_data.user.user_id),
            info_url: "info".to_string(),
            transaction_url_format: "transaction format".to_string(),
            one_sec_enabled: None,
        },
    );
    assert!(matches!(add_token_response, registry_canister::add_token::Response::Success));

    // A ledger which is frozen but still installed is left alone
    freeze(env, ledger_canister_id, *controller);
    env.advance_time(Duration::from_millis(11 * HOUR_IN_MS));
    tick_many(env, 10);
    assert!(!is_marked_uninstalled(env, canister_ids.registry, ledger_canister_id));

    // The management canister charges a frozen canister for calls about it too, so it can only be
    // uninstalled once topped up, after which it is frozen again
    env.add_cycles(ledger_canister_id, 2 * env.cycle_balance(ledger_canister_id));
    env.uninstall_canister(ledger_canister_id, Some(*controller)).unwrap();
    freeze(env, ledger_canister_id, *controller);
    env.advance_time(Duration::from_millis(11 * HOUR_IN_MS));

    for _ in 0..20 {
        env.tick();
        if is_marked_uninstalled(env, canister_ids.registry, ledger_canister_id) {
            return;
        }
    }
    panic!("Ledger was not marked uninstalled");
}

// Raises the freezing threshold above the balance. The memory allocation keeps the cycles the
// canister burns, and so the threshold, the same once it is uninstalled and its memory freed.
fn freeze(env: &PocketIc, canister_id: CanisterId, controller: Principal) {
    env.update_canister_settings(
        canister_id,
        Some(controller),
        pocket_ic::CanisterSettings {
            memory_allocation: Some(Nat::from(1u64 << 30)),
            ..Default::default()
        },
    )
    .unwrap();

    let status = env.canister_status(canister_id, Some(controller)).unwrap();
    let to_u128 = |nat: &Nat| -> u128 { nat.0.clone().try_into().unwrap() };
    let burned_per_day = to_u128(&status.idle_cycles_burned_per_day);
    let freezing_threshold_secs = 2 * to_u128(&status.cycles) * 24 * 60 * 60 / burned_per_day;
    set_freezing_threshold(env, canister_id, controller, freezing_threshold_secs.into());
}

fn is_marked_uninstalled(env: &PocketIc, registry: CanisterId, ledger_canister_id: CanisterId) -> bool {
    match client::registry::updates(
        env,
        random_principal(),
        registry,
        &registry_canister::updates::Args { since: None },
    ) {
        registry_canister::updates::Response::Success(result) => result
            .tokens_uninstalled
            .is_some_and(|uninstalled| uninstalled.contains(&ledger_canister_id)),
        response => panic!("'updates' error: {response:?}"),
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
            ledger_canister_id: CHAT_LEDGER_CANISTER_ID,
            amount: 100_000_000 + CHAT_TRANSFER_FEE,
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
