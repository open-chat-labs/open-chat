use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use types::icrc1::Account;
use types::{C2CError, CanisterId};

#[async_trait]
pub trait SwapClient {
    fn canister_id(&self) -> CanisterId;
    fn use_icrc2(&self) -> bool {
        false
    }
    fn auto_withdrawals(&self) -> bool {
        false
    }
    async fn deposit_account(&self) -> Result<Account, C2CError>;
    async fn deposit(&self, amount: u128) -> Result<u128, C2CError>;
    async fn swap(&self, amount: u128, min_amount_out: u128) -> Result<Result<SwapSuccess, String>, C2CError>;
    async fn withdraw(&self, successful_swap: bool, amount: u128) -> Result<u128, C2CError>;
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SwapSuccess {
    pub amount_out: u128,
    pub withdrawal_success: Option<bool>,
}
