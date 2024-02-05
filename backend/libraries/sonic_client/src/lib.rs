use candid::{Int, Nat};
use ic_cdk::api::call::{CallResult, RejectionCode};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use sonic_canister::SonicResult;
use std::cell::Cell;
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
    deposit_subaccount: [u8; 32],
}

impl SonicClient {
    pub fn new(
        this_canister_id: CanisterId,
        sonic_canister_id: CanisterId,
        token0: TokenInfo,
        token1: TokenInfo,
        zero_for_one: bool,
        deposit_subaccount: [u8; 32],
    ) -> Self {
        SonicClient {
            this_canister_id,
            sonic_canister_id,
            token0,
            token1,
            zero_for_one,
            deposit_subaccount,
        }
    }

    pub async fn deposit_account(&self) -> CallResult<Account> {
        retrieve_subaccount(self.sonic_canister_id).await.map(|sa| Account {
            owner: self.sonic_canister_id,
            subaccount: Some(sa),
        })
    }

    pub async fn deposit(&self, amount: u128) -> CallResult<u128> {
        let args = (self.input_token().ledger, amount.into());
        match sonic_canister_c2c_client::deposit(self.sonic_canister_id, args).await?.0 {
            SonicResult::Ok(amount_deposited) => Ok(nat_to_u128(amount_deposited)),
            SonicResult::Err(error) => Err(convert_error(error)),
        }
    }

    pub async fn swap(&self, amount: u128) -> CallResult<u128> {
        let args = (
            Nat::from(amount),
            Nat::from(0u32),
            vec![self.input_token().ledger.to_string(), self.output_token().ledger.to_string()],
            self.this_canister_id,
            Int::from(u64::MAX),
        );
        match sonic_canister_c2c_client::swap_exact_tokens_for_tokens(self.sonic_canister_id, args.clone())
            .await?
            .0
        {
            SonicResult::Ok(_tx_id) => {
                unimplemented!()
            }
            SonicResult::Err(error) => Err(convert_error(error)),
        }
    }

    pub async fn withdraw(&self, amount: u128) -> CallResult<u128> {
        let args = (self.output_token().ledger, amount.into());
        match sonic_canister_c2c_client::withdraw(self.sonic_canister_id, args).await?.0 {
            SonicResult::Ok(amount_withdrawn) => Ok(nat_to_u128(amount_withdrawn)),
            SonicResult::Err(error) => Err(convert_error(error)),
        }
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
