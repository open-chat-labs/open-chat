use crate::metadata_helper::MetadataHelper;
use crate::{mutate_state, read_state};
use constants::HOUR_IN_MS;
use ic_cdk::call::RejectCode;
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;
use std::time::Duration;
use tracing::{error, info};
use types::{C2CError, CanisterId};
use utils::canister::{canister_info, is_out_of_cycles_error, is_target_canister_uninstalled_or_deleted};
use utils::canister_timers::run_now_then_interval;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(11 * HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::futures::spawn_migratory(run_async());
}

async fn run_async() {
    let tokens: Vec<_> = read_state(|state| {
        state
            .data
            .tokens
            .iter()
            .map(|t| (t.ledger_canister_id, t.uninstalled))
            .collect()
    });

    futures::future::join_all(
        tokens
            .into_iter()
            .map(|(ledger_canister_id, uninstalled)| check_for_token_updates(ledger_canister_id, uninstalled)),
    )
    .await;
}

async fn check_for_token_updates(ledger_canister_id: CanisterId, uninstalled: bool) -> Result<(), C2CError> {
    // A ledger marked uninstalled is checked too, so that one which is installed again is picked up,
    // but by asking the IC whether it has a Wasm module again rather than by calling it, which keeps
    // the calls to the ones still uninstalled out of the error logs
    if uninstalled && !has_wasm_module(ledger_canister_id).await {
        return Ok(());
    }

    let metadata = get_metadata(ledger_canister_id).await?;
    let metadata_helper = match MetadataHelper::try_parse(metadata) {
        Ok(h) => h,
        Err(reason) => {
            let error = format!("Token metadata is incomplete: {reason}");
            error!(%ledger_canister_id, error);
            return Err(C2CError::new(
                ledger_canister_id,
                "icrc1_metadata",
                RejectCode::CanisterError,
                error,
            ));
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

            if let Some(logo) = metadata_helper.logo().cloned()
                && logo != token.logo
            {
                args.logo = Some(logo);
            }

            let fee = metadata_helper.fee();
            if fee != token.fee {
                args.fee = Some(fee);
            }

            let burn_fee = metadata_helper.burn_fee();
            if burn_fee != token.burn_fee {
                args.burn_fee = Some(burn_fee);
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

async fn get_metadata(ledger_canister_id: CanisterId) -> Result<Vec<(String, MetadataValue)>, C2CError> {
    match icrc_ledger_canister_c2c_client::icrc1_metadata(ledger_canister_id).await {
        Ok(metadata) => {
            mutate_state(|state| {
                state.data.tokens.set_uninstalled(ledger_canister_id, false, state.env.now());
            });
            Ok(metadata)
        }
        Err(error) => {
            if is_ledger_uninstalled_or_deleted(ledger_canister_id, &error).await {
                mutate_state(|state| {
                    state.data.tokens.set_uninstalled(ledger_canister_id, true, state.env.now());
                });
            }
            Err(error)
        }
    }
}

// The IC uninstalls a ledger once it runs out of cycles, after which calls to it fail as being out of
// cycles rather than as it having no Wasm module, so in that case ask the IC whether it still has one
async fn is_ledger_uninstalled_or_deleted(ledger_canister_id: CanisterId, error: &C2CError) -> bool {
    if is_target_canister_uninstalled_or_deleted(error.reject_code(), error.message()) {
        true
    } else if is_out_of_cycles_error(error.reject_code(), error.message()) {
        canister_info(ledger_canister_id)
            .await
            .is_ok_and(|info| info.module_hash.is_none())
    } else {
        false
    }
}

async fn has_wasm_module(canister_id: CanisterId) -> bool {
    canister_info(canister_id).await.is_ok_and(|info| info.module_hash.is_some())
}
