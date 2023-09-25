use candid::{Int, Nat};
use ic_cdk::api::call::{CallResult, RejectionCode};
use ledger_utils::convert_to_subaccount;
use serde::{Deserialize, Serialize};
use sonic_canister::SonicResult;
use types::icrc1::Account;
use types::{CanisterId, TokenInfo};

const FEE_DECIMAL: f64 = 0.003; // 0.3%

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

    pub fn deposit_account(&self) -> (CanisterId, Account) {
        (
            self.input_token().ledger,
            Account {
                owner: self.sonic_canister_id,
                subaccount: Some(convert_to_subaccount(&self.this_canister_id).0),
            },
        )
    }

    pub fn input_token(&self) -> &TokenInfo {
        if self.zero_for_one {
            &self.token0
        } else {
            &self.token1
        }
    }

    pub fn output_token(&self) -> &TokenInfo {
        if self.zero_for_one {
            &self.token1
        } else {
            &self.token0
        }
    }

    pub async fn quote(&self, amount: u128) -> CallResult<u128> {
        let args = (self.token0.ledger, self.token1.ledger);

        match sonic_canister_c2c_client::get_pair(self.sonic_canister_id, args).await?.0 {
            Some(pair_info) => {
                let reserve0 = nat_to_u128(pair_info.reserve0) as f64;
                let reserve1 = nat_to_u128(pair_info.reserve1) as f64;

                if reserve0 <= 0.0 || reserve1 <= 0.0 {
                    Ok(0)
                } else {
                    let k = reserve0 / reserve1;
                    if self.zero_for_one {
                        let new_reserve0 = reserve0 + amount as f64;
                        let new_reserve1 = new_reserve0 / k;
                        let amount_out = (new_reserve1 - reserve1) * (1.0 - FEE_DECIMAL);
                        Ok(amount_out as u128)
                    } else {
                        let new_reserve1 = reserve1 + amount as f64;
                        let new_reserve0 = new_reserve1 * k;
                        let amount_out = (new_reserve0 - reserve0) * (1.0 - FEE_DECIMAL);
                        Ok(amount_out as u128)
                    }
                }
            }
            None => Err((
                RejectionCode::Unknown,
                format!(
                    "Pair info not found. Token0: {}. Token1: {}",
                    self.token0.ledger, self.token1.ledger
                ),
            )),
        }
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
            Nat::from(0),
            vec![self.input_token().ledger.to_string(), self.output_token().ledger.to_string()],
            self.this_canister_id,
            Int::from(0),
        );
        match sonic_canister_c2c_client::swap_exact_tokens_for_tokens(self.sonic_canister_id, args)
            .await?
            .0
        {
            SonicResult::Ok(amount_out) => Ok(nat_to_u128(amount_out)),
            SonicResult::Err(error) => Err(convert_error(error)),
        }
    }

    pub async fn withdraw(&self, amount: u128) -> CallResult<u128> {
        let args = (self.output_token().ledger, amount.into());
        match sonic_canister_c2c_client::withdraw(self.sonic_canister_id, args).await?.0 {
            SonicResult::Ok(amount_deposited) => Ok(nat_to_u128(amount_deposited)),
            SonicResult::Err(error) => Err(convert_error(error)),
        }
    }
}

fn nat_to_u128(value: Nat) -> u128 {
    value.0.try_into().unwrap()
}

fn convert_error(error: String) -> (RejectionCode, String) {
    (RejectionCode::Unknown, error)
}
