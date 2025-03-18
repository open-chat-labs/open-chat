use crate::{mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ckbtc_minter_canister::update_balance::{UpdateBalanceError, UtxoStatus};
use ckbtc_minter_canister::{CKBTC_MINTER_CANISTER_ID, TESTNET_CKBTC_MINTER_CANISTER_ID};
use ledger_utils::format_crypto_amount;
use tracing::error;
use user_canister::update_btc_balance::{Response::*, *};

#[update(msgpack = true)]
#[trace]
async fn update_btc_balance(_args: Args) -> Response {
    run_regular_jobs();

    let test_mode = read_state(|state| state.data.test_mode);
    let ckbtc_minter_canister_id = if test_mode { TESTNET_CKBTC_MINTER_CANISTER_ID } else { CKBTC_MINTER_CANISTER_ID };

    match ckbtc_minter_canister_c2c_client::update_balance(
        ckbtc_minter_canister_id,
        &ckbtc_minter_canister::update_balance::Args::default(),
    )
    .await
    {
        Ok(Ok(utxos)) => {
            let mut total_minted = 0;
            let mut errors = Vec::new();
            for utxo in utxos {
                match utxo {
                    UtxoStatus::Minted(m) => total_minted += m.minted_amount,
                    error => errors.push(format!("{error:?}")),
                }
            }

            mutate_state(|state| {
                if total_minted > 0 {
                    let formatted = format_crypto_amount(total_minted as u128, 8);
                    crate::openchat_bot::send_text_message(
                        format!(
                            "BTC deposit received!
Your account has been credited with {formatted} BTC."
                        ),
                        Vec::new(),
                        false,
                        state,
                    );
                }
                for error in errors {
                    crate::openchat_bot::send_text_message(
                        format!(
                            "Failed to credit account with BTC:
Error: {error:?}",
                        ),
                        Vec::new(),
                        false,
                        state,
                    );
                }
            });

            Success
        }
        Ok(Err(error)) => {
            if matches!(error, UpdateBalanceError::NoNewUtxos(_)) {
                NoUpdates
            } else {
                error!(?error, "Failed to update BTC balance");
                Error(format!("{error:?}"))
            }
        }
        Err(error) => Error(format!("{error:?}")),
    }
}
