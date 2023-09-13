use ic_cdk::api::call::{CallResult, RejectionCode};
use icpswap_swap_pool_canister::ICPSwapResult;
use ledger_utils::convert_to_subaccount;
use types::icrc1::{Account, TransferArg};
use types::{CanisterId, TokenInfo};

pub struct ICPSwapClient {
    pub this_canister_id: CanisterId,
    pub swap_canister_id: CanisterId,
    pub token0: TokenInfo,
    pub token1: TokenInfo,
}

impl ICPSwapClient {
    pub fn new(this_canister_id: CanisterId, swap_canister_id: CanisterId, token0: TokenInfo, token1: TokenInfo) -> Self {
        ICPSwapClient {
            this_canister_id,
            swap_canister_id,
            token0,
            token1,
        }
    }

    pub async fn quote(&self, amount: u128, zero_for_one: bool) -> CallResult<u128> {
        let args = icpswap_swap_pool_canister::quote::Args {
            operator: self.this_canister_id,
            amount_in: amount.to_string(),
            zero_for_one,
            amount_out_minimum: "0".to_string(),
        };

        match icpswap_swap_pool_canister_c2c_client::quote(self.swap_canister_id, &args).await? {
            ICPSwapResult::Ok(amount_out) => Ok(amount_out.0.try_into().unwrap()),
            ICPSwapResult::Err(e) => Err((RejectionCode::CanisterError, format!("{e:?}"))),
        }
    }

    pub async fn swap(&self, amount: u128, zero_for_one: bool) -> CallResult<u128> {
        let ledger_canister_id = if zero_for_one { self.token0.ledger } else { self.token1.ledger };

        icrc1_ledger_canister_c2c_client::icrc1_transfer(
            ledger_canister_id,
            &TransferArg {
                from_subaccount: None,
                to: Account {
                    owner: self.swap_canister_id,
                    subaccount: Some(convert_to_subaccount(&self.this_canister_id).0),
                },
                fee: None,
                created_at_time: None,
                memo: None,
                amount: amount.into(),
            },
        )
        .await?
        .map_err(|t| (RejectionCode::Unknown, format!("{t:?}")))?;

        let swap_args = icpswap_swap_pool_canister::swap::Args {
            operator: self.this_canister_id,
            amount_in: amount.to_string(),
            zero_for_one,
            amount_out_minimum: "0".to_string(),
        };

        match icpswap_swap_pool_canister_c2c_client::swap(self.swap_canister_id, &swap_args).await? {
            ICPSwapResult::Ok(amount_out) => Ok(amount_out.0.try_into().unwrap()),
            ICPSwapResult::Err(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        }
    }
}
