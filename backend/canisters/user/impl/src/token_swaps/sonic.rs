use super::swap_client::SwapClient;
use async_trait::async_trait;
use candid::{Int, Nat};
use ic_cdk::api::call::{CallResult, RejectionCode};
use serde::{Deserialize, Serialize};
use sonic_canister::SonicResult;
use std::cell::Cell;
use types::icrc1::Account;
use types::{CanisterId, TokenInfo};

thread_local! {
    static SUBACCOUNT: Cell<[u8; 32]> = Cell::default();
}

#[derive(Serialize, Deserialize)]
pub struct SonicClient {
    this_canister_id: CanisterId,
    sonic_canister_id: CanisterId,
    token0: TokenInfo,
    token1: TokenInfo,
    zero_for_one: bool,
}

impl SonicClient {
    pub fn new(
        this_canister_id: CanisterId,
        sonic_canister_id: CanisterId,
        token0: TokenInfo,
        token1: TokenInfo,
        zero_for_one: bool,
    ) -> Self {
        SonicClient {
            this_canister_id,
            sonic_canister_id,
            token0,
            token1,
            zero_for_one,
        }
    }

    pub async fn deposit_account(&self) -> CallResult<Account> {
        retrieve_subaccount(self.sonic_canister_id).await.map(|sa| Account {
            owner: self.sonic_canister_id,
            subaccount: Some(sa),
        })
    }

    pub async fn deposit(&self, amount: u128) -> CallResult<u128> {
        let token = self.input_token();
        let args = (token.ledger, amount.saturating_sub(token.fee).into());
        match sonic_canister_c2c_client::deposit(self.sonic_canister_id, args).await?.0 {
            SonicResult::Ok(amount_deposited) => Ok(nat_to_u128(amount_deposited)),
            SonicResult::Err(error) => Err(convert_error(error)),
        }
    }

    pub async fn swap(&self, amount: u128, min_amount_out: u128) -> CallResult<Result<u128, String>> {
        let args = (
            Nat::from(amount),
            Nat::from(min_amount_out),
            vec![self.input_token().ledger.to_string(), self.output_token().ledger.to_string()],
            self.this_canister_id,
            Int::from(u64::MAX),
        );
        match sonic_canister_c2c_client::swap_exact_tokens_for_tokens(self.sonic_canister_id, args.clone())
            .await?
            .0
        {
            SonicResult::Ok(amount_out) => Ok(Ok(nat_to_u128(amount_out))),
            SonicResult::Err(error) => Ok(Err(error)),
        }
    }

    pub async fn withdraw(&self, successful_swap: bool, amount: u128) -> CallResult<u128> {
        let token = if successful_swap { self.output_token() } else { self.input_token() };
        let amount = if successful_swap { amount } else { amount.saturating_sub(token.fee) };
        withdraw(self.sonic_canister_id, token.ledger, amount).await
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

pub async fn withdraw(swap_canister_id: CanisterId, ledger_canister_id: CanisterId, amount: u128) -> CallResult<u128> {
    let args = (ledger_canister_id, amount.into());
    match sonic_canister_c2c_client::withdraw(swap_canister_id, args).await?.0 {
        SonicResult::Ok(amount_withdrawn) => Ok(nat_to_u128(amount_withdrawn)),
        SonicResult::Err(error) => Err(convert_error(error)),
    }
}

async fn retrieve_subaccount(sonic_canister_id: CanisterId) -> CallResult<[u8; 32]> {
    let current = SUBACCOUNT.get();
    if current != [0; 32] {
        Ok(current)
    } else {
        match sonic_canister_c2c_client::initiate_icrc1_transfer(sonic_canister_id).await {
            Ok(sa) => {
                SUBACCOUNT.set(sa);
                Ok(sa)
            }
            Err(error) => Err(error),
        }
    }
}

fn nat_to_u128(value: Nat) -> u128 {
    value.0.try_into().unwrap()
}

fn convert_error(error: String) -> (RejectionCode, String) {
    (RejectionCode::Unknown, error)
}

#[async_trait]
impl SwapClient for SonicClient {
    async fn deposit_account(&self) -> CallResult<Account> {
        self.deposit_account().await
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
