use ic_cdk::api::call::{CallResult, RejectionCode};
use icpswap_swap_pool_canister::{ICPSwapError, ICPSwapResult};
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
        let input_ledger = if zero_for_one { self.token0.ledger } else { self.token1.ledger };
        let output_ledger = if zero_for_one { self.token1.ledger } else { self.token0.ledger };

        icrc1_ledger_canister_c2c_client::icrc1_transfer(
            input_ledger,
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

        let deposit_args = icpswap_swap_pool_canister::deposit::Args {
            token: input_ledger.to_string(),
            amount: amount.into(),
        };
        if let ICPSwapResult::Err(error) =
            icpswap_swap_pool_canister_c2c_client::deposit(self.swap_canister_id, &deposit_args).await?
        {
            return Err(convert_error(error));
        }

        let swap_args = icpswap_swap_pool_canister::swap::Args {
            operator: self.this_canister_id,
            amount_in: amount.to_string(),
            zero_for_one,
            amount_out_minimum: "0".to_string(),
        };

        let amount_to_withdraw = match icpswap_swap_pool_canister_c2c_client::swap(self.swap_canister_id, &swap_args).await? {
            ICPSwapResult::Ok(amount_out) => amount_out,
            ICPSwapResult::Err(error) => return Err(convert_error(error)),
        };

        let withdraw_arg = icpswap_swap_pool_canister::withdraw::Args {
            token: output_ledger.to_string(),
            amount: amount_to_withdraw,
        };
        match icpswap_swap_pool_canister_c2c_client::withdraw(self.swap_canister_id, &withdraw_arg).await? {
            ICPSwapResult::Ok(amount_out) => Ok(amount_out.0.try_into().unwrap()),
            ICPSwapResult::Err(error) => Err(convert_error(error)),
        }
    }
}

fn convert_error(error: ICPSwapError) -> (RejectionCode, String) {
    (RejectionCode::Unknown, format!("{error:?}"))
}
