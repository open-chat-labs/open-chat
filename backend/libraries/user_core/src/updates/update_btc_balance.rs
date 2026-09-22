use ckbtc_minter_canister::update_balance::{UpdateBalanceError, UtxoStatus};
use ckbtc_minter_canister::{CKBTC_MINTER_CANISTER_ID, TESTNET_CKBTC_MINTER_CANISTER_ID};
use oc_error_codes::OCErrorCode;
use serde::Serialize;
use tracing::error;
use types::{OCResult, UserId, icrc1};

// What the ckBTC minter credited the user's account with, and any deposits it couldn't. The
// caller tells the user of each via the OpenChat bot, records the deposit and awards the
// achievement.
pub struct BtcBalanceUpdate {
    pub minted: u64,
    pub errors: Vec<String>,
}

pub async fn update_btc_balance(my_user_id: UserId, test_mode: bool) -> OCResult<BtcBalanceUpdate> {
    let ckbtc_minter_canister_id = if test_mode { TESTNET_CKBTC_MINTER_CANISTER_ID } else { CKBTC_MINTER_CANISTER_ID };

    match ckbtc_minter_canister_c2c_client::update_balance(
        ckbtc_minter_canister_id,
        &ckbtc_minter_canister::update_balance::Args {
            owner: None,
            subaccount: icrc1::Account::for_user(my_user_id).subaccount,
        },
    )
    .await?
    {
        Ok(utxos) => {
            let mut update = BtcBalanceUpdate {
                minted: 0,
                errors: Vec::new(),
            };
            for utxo in utxos {
                match utxo {
                    UtxoStatus::Minted(m) => update.minted += m.minted_amount,
                    error => update.errors.push(format!("{error:?}")),
                }
            }
            Ok(update)
        }
        Err(error) => {
            if matches!(error, UpdateBalanceError::NoNewUtxos(_)) {
                Err(OCErrorCode::NoChange.into())
            } else {
                error!(?error, "Failed to update BTC balance");
                Err(OCErrorCode::Unknown.with_json(&error))
            }
        }
    }
}

#[derive(Serialize)]
pub struct BtcDepositOrWithdrawalEventPayload {
    pub amount: u64,
}
