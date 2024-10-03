use super::swap_client::SwapClient;
use async_trait::async_trait;
use candid::Nat;
use ic_cdk::api::call::{CallResult, RejectionCode};
use icpswap_swap_pool_canister::{ICPSwapError, ICPSwapResult};
use ledger_utils::convert_to_subaccount;
use serde::{Deserialize, Serialize};
use types::icrc1::Account;
use types::{CanisterId, TokenInfo};

#[derive(Serialize, Deserialize)]
pub struct ICPSwapClient {
    this_canister_id: CanisterId,
    swap_canister_id: CanisterId,
    token0: TokenInfo,
    token1: TokenInfo,
    zero_for_one: bool,
}

impl ICPSwapClient {
    pub fn new(
        this_canister_id: CanisterId,
        swap_canister_id: CanisterId,
        token0: TokenInfo,
        token1: TokenInfo,
        zero_for_one: bool,
    ) -> Self {
        ICPSwapClient {
            this_canister_id,
            swap_canister_id,
            token0,
            token1,
            zero_for_one,
        }
    }

    pub fn deposit_account(&self) -> Account {
        Account {
            owner: self.swap_canister_id,
            subaccount: Some(convert_to_subaccount(&self.this_canister_id).0),
        }
    }

    pub async fn deposit(&self, amount: u128) -> CallResult<u128> {
        let token = self.input_token();
        let args = icpswap_swap_pool_canister::deposit::Args {
            token: token.ledger.to_string(),
            amount: amount.into(),
            fee: token.fee.into(),
        };
        match icpswap_swap_pool_canister_c2c_client::deposit(self.swap_canister_id, &args).await? {
            ICPSwapResult::Ok(amount_deposited) => Ok(nat_to_u128(amount_deposited)),
            ICPSwapResult::Err(error) => Err(convert_error(error)),
        }
    }

    pub async fn swap(&self, amount: u128, min_amount_out: u128) -> CallResult<Result<u128, String>> {
        let args = icpswap_swap_pool_canister::swap::Args {
            operator: self.this_canister_id,
            amount_in: amount.to_string(),
            zero_for_one: self.zero_for_one,
            amount_out_minimum: min_amount_out.to_string(),
        };
        match icpswap_swap_pool_canister_c2c_client::swap(self.swap_canister_id, &args).await? {
            ICPSwapResult::Ok(amount_out) => Ok(Ok(nat_to_u128(amount_out))),
            ICPSwapResult::Err(error) => Ok(Err(format!("{error:?}"))),
        }
    }

    pub async fn withdraw(&self, successful_swap: bool, amount: u128) -> CallResult<u128> {
        let token = if successful_swap { self.output_token() } else { self.input_token() };
        withdraw(self.swap_canister_id, token.ledger, amount, token.fee).await
    }

    fn input_token(&self) -> &TokenInfo {
        if self.zero_for_one {
            &self.token0
        } else {
            &self.token1
        }
    }

    fn output_token(&self) -> &TokenInfo {
        if self.zero_for_one {
            &self.token1
        } else {
            &self.token0
        }
    }
}

pub async fn withdraw(
    swap_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
    amount: u128,
    fee: u128,
) -> CallResult<u128> {
    let args = icpswap_swap_pool_canister::withdraw::Args {
        token: ledger_canister_id.to_string(),
        amount: amount.into(),
        fee: fee.into(),
    };
    match icpswap_swap_pool_canister_c2c_client::withdraw(swap_canister_id, &args).await? {
        ICPSwapResult::Ok(amount_out) => Ok(nat_to_u128(amount_out)),
        ICPSwapResult::Err(error) => Err(convert_error(error)),
    }
}

fn nat_to_u128(value: Nat) -> u128 {
    value.0.try_into().unwrap()
}

fn convert_error(error: ICPSwapError) -> (RejectionCode, String) {
    (RejectionCode::Unknown, format!("{error:?}"))
}

#[async_trait]
impl SwapClient for ICPSwapClient {
    async fn deposit_account(&self) -> CallResult<Account> {
        Ok(self.deposit_account())
    }

    async fn deposit(&self, amount: u128) -> CallResult<()> {
        self.deposit(amount).await.map(|_| ())
    }

    async fn swap(&self, amount: u128, min_amount_out: u128) -> CallResult<Result<u128, String>> {
        self.swap(amount, min_amount_out).await
    }

    async fn withdraw(&self, successful_swap: bool, amount: u128) -> CallResult<u128> {
        self.withdraw(successful_swap, amount).await
    }
}
