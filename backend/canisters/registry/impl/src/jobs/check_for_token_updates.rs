use crate::metadata_helper::MetadataHelper;
use crate::{mutate_state, read_state};
use constants::HOUR_IN_MS;
use ic_cdk::api::call::RejectionCode;
use std::time::Duration;
use tracing::{error, info};
use types::CanisterId;
use utils::canister_timers::run_now_then_interval;

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
    let metadata_helper = match MetadataHelper::try_parse(metadata) {
        Ok(h) => h,
        Err(reason) => {
            let error = format!("Token metadata is incomplete: {reason}");
            error!(%ledger_canister_id, error);
            return Err((RejectionCode::Unknown, error));
        }
    };

    mutate_state(|state| {
        if let Some(token) = state.data.tokens.get(ledger_canister_id).cloned() {
            let mut args = registry_canister::update_token::Args::new(ledger_canister_id);
            if *metadata_helper.name() != token.name {
                args.name = Some(metadata_helper.name().to_string());
            }

            if *metadata_helper.symbol() != token.symbol {
                args.symbol = Some(metadata_helper.symbol().to_string());
            }

            if let Some(logo) = metadata_helper.logo().cloned() {
                if logo != token.logo {
                    args.logo = Some(logo);
                }
            }

            let fee = metadata_helper.fee();
            if fee != token.fee {
                args.fee = Some(fee);
            }

            if args.has_updates() {
                state.data.tokens.update(args, state.env.now());
            }

            if token.enabled && !metadata_helper.is_icrc1_compatible() {
                state
                    .data
                    .tokens
                    .set_enabled(token.ledger_canister_id, false, state.env.now());

                info!(%token.ledger_canister_id, "Token disabled because it is not ICRC compatible");
            }
        }
    });

    Ok(())
}
