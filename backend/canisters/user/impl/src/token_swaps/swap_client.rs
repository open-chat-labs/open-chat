use async_trait::async_trait;
use candid::Deserialize;
use ic_cdk::api::call::CallResult;
use serde::Serialize;
use types::icrc1::Account;
use types::CanisterId;

#[async_trait]
pub trait SwapClient {
    fn canister_id(&self) -> CanisterId;
    fn use_icrc2(&self) -> bool {
        false
    }
    fn auto_withdrawals(&self) -> bool {
        false
    }
    async fn deposit_account(&self) -> CallResult<Account>;
    async fn deposit(&self, amount: u128) -> CallResult<u128>;
    async fn swap(&self, amount: u128, min_amount_out: u128) -> CallResult<Result<SwapSuccess, String>>;
    async fn withdraw(&self, successful_swap: bool, amount: u128) -> CallResult<u128>;
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(from = "u128")]
pub struct SwapSuccess {
    pub amount_out: u128,
    pub withdrawal_success: Option<bool>,
}

impl From<u128> for SwapSuccess {
    fn from(value: u128) -> Self {
        SwapSuccess {
            amount_out: value,
            withdrawal_success: None,
        }
    }
}
