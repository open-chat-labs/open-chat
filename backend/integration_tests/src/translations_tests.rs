use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{tick_many, try_metrics};
use crate::{TestEnv, client, wasms};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;

// The Translations canister pays 1 CHAT for each approved translation
const PAYMENT_AMOUNT: u128 = 100_000_000;

// The Translations canister's payment for an approved translation, if its ledger can't be called (eg.
// because the ledger is being upgraded), is retried after a delay which doubles with each failure,
// rather than round after round. A stopped ledger is first retried after 10 seconds.
#[test]
fn payment_failing_to_call_into_ledger_is_retried_with_backoff() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let ledger = canister_ids.chat_ledger;
    let translations = canister_ids.translations;
    let proposer = client::register_user(env, canister_ids);
    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);
    client::ledger::happy_path::transfer(env, *controller, ledger, translations, 10 * PAYMENT_AMOUNT);

    let proposer_balance = |env: &PocketIc| client::ledger::happy_path::balance_of(env, ledger, proposer.user_id);
    let awaiting_retry = |env: &PocketIc| {
        try_metrics(env, translations).unwrap()["payments_awaiting_retry"]
            .as_u64()
            .unwrap()
    };
    let awaiting_retry_before = awaiting_retry(env);

    let translations_canister::propose::Response::Success(id) = client::translations::propose(
        env,
        proposer.principal,
        translations,
        &translations_canister::propose::Args {
            locale: "en".to_string(),
            key: format!("test.{}", random_string()),
            value: "Hello".to_string(),
        },
    ) else {
        panic!("Failed to propose translation");
    };

    // Approving a translation doesn't call into the ledger, so the ledger is stopped by the time the
    // canister pays the proposer
    stop_canister(env, *controller, ledger);
    let response = client::translations::approve(
        env,
        operator.principal,
        translations,
        &translations_canister::approve::Args { id },
    );
    assert!(matches!(response, translations_canister::approve::Response::Success));

    tick_many(env, 20);
    assert_eq!(awaiting_retry(env), awaiting_retry_before + 1);

    // The retry is persisted, so it survives an upgrade of the canister
    let wasm = wasms::TRANSLATIONS.clone();
    let args = candid::encode_one(translations_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    stop_canister(env, *controller, translations);
    env.upgrade_canister(translations, wasm.module.into(), args, Some(*controller))
        .unwrap();
    start_canister(env, *controller, translations);
    assert_eq!(awaiting_retry(env), awaiting_retry_before + 1);

    // Retried 10 seconds after the 1st failure, by when the ledger is still stopped
    env.advance_time(Duration::from_secs(11));
    tick_many(env, 10);

    // Then 20 seconds after the 2nd, by when the ledger is back. Time doesn't pass as the rounds do,
    // so however many there are before then, the payment isn't retried.
    start_canister(env, *controller, ledger);
    tick_many(env, 20);
    env.advance_time(Duration::from_secs(15));
    tick_many(env, 10);
    assert_eq!(proposer_balance(env), 0);
    env.advance_time(Duration::from_secs(6));
    tick_many(env, 10);
    assert_eq!(proposer_balance(env), PAYMENT_AMOUNT);
    assert_eq!(awaiting_retry(env), awaiting_retry_before);

    // The Translations canister was upgraded, so the env isn't returned to the pool
    wrapper.discard();
}
