use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ckbtc_minter_canister::update_balance::{UpdateBalanceError, UtxoStatus};
use ckbtc_minter_canister::{CKBTC_MINTER_CANISTER_ID, TESTNET_CKBTC_MINTER_CANISTER_ID};
use event_store_types::EventBuilder;
use ledger_utils::format_crypto_amount;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use serde::Serialize;
use tracing::error;
use types::Achievement;
use user_canister::update_btc_balance::*;

#[update(msgpack = true)]
#[trace]
async fn update_btc_balance(_args: Args) -> Response {
    execute_update_async(update_btc_balance_impl).await
}

async fn update_btc_balance_impl() -> Response {
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
                    let user_id_string = state.env.canister_id().to_string();
                    let now = state.env.now();
                    state.push_local_user_index_canister_event(
                        LocalUserIndexEvent::EventStoreEvent(
                            EventBuilder::new("btc_deposit", now)
                                .with_user(user_id_string.clone(), true)
                                .with_source(user_id_string, true)
                                .with_json_payload(&BtcDepositOrWithdrawalEventPayload { amount: total_minted })
                                .build(),
                        ),
                        now,
                    );
                    state.award_achievement_and_notify(Achievement::DepositedBtc, now);
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

            Response::Success
        }
        Ok(Err(error)) => {
            if matches!(error, UpdateBalanceError::NoNewUtxos(_)) {
                Response::Error(OCErrorCode::NoChange.into())
            } else {
                error!(?error, "Failed to update BTC balance");
                Response::Error(OCErrorCode::Unknown.with_json(&error))
            }
        }
        Err(error) => Response::Error(error.into()),
    }
}

#[derive(Serialize)]
pub(crate) struct BtcDepositOrWithdrawalEventPayload {
    pub amount: u64,
}
