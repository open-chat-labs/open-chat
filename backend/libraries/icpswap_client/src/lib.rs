use candid::Nat;
use ic_cdk::api::call::{CallResult, RejectionCode};
use icpswap_swap_pool_canister::{ICPSwapError, ICPSwapResult};
use ledger_utils::convert_to_subaccount;
use types::icrc1::Account;
use types::{CanisterId, TokenInfo};

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

    pub async fn quote(&self, amount: u128) -> CallResult<u128> {
        let args = icpswap_swap_pool_canister::quote::Args {
            operator: self.this_canister_id,
            amount_in: amount.to_string(),
            zero_for_one: self.zero_for_one,
            amount_out_minimum: "0".to_string(),
        };

        match icpswap_swap_pool_canister_c2c_client::quote(self.swap_canister_id, &args).await? {
            ICPSwapResult::Ok(amount_out) => Ok(amount_out.0.try_into().unwrap()),
            ICPSwapResult::Err(e) => Err((RejectionCode::CanisterError, format!("{e:?}"))),
        }
    }

    pub async fn deposit(&self, amount: u128) -> CallResult<u128> {
        let args = icpswap_swap_pool_canister::deposit::Args {
            token: self.get_ledger(self.zero_for_one).to_string(),
            amount: amount.into(),
        };
        match icpswap_swap_pool_canister_c2c_client::deposit(self.swap_canister_id, &args).await? {
            ICPSwapResult::Ok(amount_deposited) => Ok(nat_to_u128(amount_deposited)),
            ICPSwapResult::Err(error) => Err(convert_error(error)),
        }
    }

    pub async fn swap(&self, amount: u128) -> CallResult<u128> {
        let args = icpswap_swap_pool_canister::swap::Args {
            operator: self.this_canister_id,
            amount_in: amount.to_string(),
            zero_for_one: self.zero_for_one,
            amount_out_minimum: "0".to_string(),
        };
        match icpswap_swap_pool_canister_c2c_client::swap(self.swap_canister_id, &args).await? {
            ICPSwapResult::Ok(amount_out) => Ok(nat_to_u128(amount_out)),
            ICPSwapResult::Err(error) => return Err(convert_error(error)),
        }
    }

    pub async fn withdraw(&self, amount: u128) -> CallResult<u128> {
        let args = icpswap_swap_pool_canister::withdraw::Args {
            token: self.get_ledger(!self.zero_for_one).to_string(),
            amount: amount.into(),
        };
        match icpswap_swap_pool_canister_c2c_client::withdraw(self.swap_canister_id, &args).await? {
            ICPSwapResult::Ok(amount_out) => Ok(nat_to_u128(amount_out)),
            ICPSwapResult::Err(error) => Err(convert_error(error)),
        }
    }

    fn get_ledger(&self, token0: bool) -> CanisterId {
        if token0 {
            self.token0.ledger
        } else {
            self.token1.ledger
        }
    }
}

fn nat_to_u128(value: Nat) -> u128 {
    value.0.try_into().unwrap()
}

fn convert_error(error: ICPSwapError) -> (RejectionCode, String) {
    (RejectionCode::Unknown, format!("{error:?}"))
}
