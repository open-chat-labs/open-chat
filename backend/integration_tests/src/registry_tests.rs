use crate::env::ENV;
use crate::rng::random_principal;
use crate::setup::install_icrc1_ledger;
use crate::utils::now_millis;
use crate::{client, TestEnv};
use registry_canister::TokenStandard;
use std::ops::Deref;
use std::time::Duration;

#[test]
fn add_token_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let ledger_canister_id = install_icrc1_ledger(
        env,
        *controller,
        "ABC Token".to_string(),
        "ABC".to_string(),
        10_000,
        Vec::new(),
    );

    let info_url = "info".to_string();
    let how_to_buy_url = "how to buy".to_string();
    let transaction_url_format = "transaction format".to_string();
    let logo = "logo".to_string();

    env.advance_time(Duration::from_secs(1));

    client::registry::add_token(
        env,
        *controller,
        canister_ids.registry,
        &registry_canister::add_token::Args {
            ledger_canister_id,
            token_standard: TokenStandard::ICRC1,
            info_url: Some(info_url.clone()),
            how_to_buy_url: Some(how_to_buy_url.clone()),
            transaction_url_format: Some(transaction_url_format.clone()),
            logo: Some(logo.clone()),
        },
    );

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
            .find(|t| t.ledger_canister_id == ledger_canister_id)
            .unwrap();

        assert_eq!(token.name, "ABC Token");
        assert_eq!(token.symbol, "ABC");
        assert_eq!(token.decimals, 8);
        assert_eq!(token.fee, 10_000);
        assert_eq!(token.info_url, Some(info_url));
        assert_eq!(token.how_to_buy_url, Some(how_to_buy_url));
        assert_eq!(token.transaction_url_format, Some(transaction_url_format));
        assert_eq!(token.logo, Some(logo));
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
