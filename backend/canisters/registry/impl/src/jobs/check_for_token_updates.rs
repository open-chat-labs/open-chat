use crate::{mutate_state, read_state};
use ic_cdk::api::call::RejectionCode;
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;
use std::time::Duration;
use types::CanisterId;
use utils::canister_timers::run_now_then_interval;
use utils::time::HOUR_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(11 * HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    let ledger_canister_ids: Vec<_> = read_state(|state| state.data.tokens.iter().map(|t| t.ledger_canister_id).collect());

    futures::future::join_all(ledger_canister_ids.into_iter().map(check_for_token_updates)).await;
}

async fn check_for_token_updates(ledger_canister_id: CanisterId) -> Result<(), (RejectionCode, String)> {
    let metadata = icrc_ledger_canister_c2c_client::icrc1_metadata(ledger_canister_id).await?;

    mutate_state(|state| {
        if let Some(token) = state.data.tokens.get(ledger_canister_id).cloned() {
            let mut args = registry_canister::update_token::Args::new(ledger_canister_id);
            for (name, value) in metadata {
                match name.as_str() {
                    "icrc1:logo" => {
                        if let MetadataValue::Text(logo) = value {
                            if logo != token.logo {
                                args.logo = Some(logo);
                            }
                        }
                    }
                    "icrc1:name" => {
                        if let MetadataValue::Text(name) = value {
                            if name != token.name {
                                args.name = Some(name);
                            }
                        }
                    }
                    "icrc1:symbol" => {
                        if let MetadataValue::Text(symbol) = value {
                            if symbol != token.symbol {
                                args.symbol = Some(symbol);
                            }
                        }
                    }
                    _ => {}
                }
            }

            if args.has_updates() {
                state.data.tokens.update(args, state.env.now());
            }
        }
    });

    Ok(())
}
