use async_trait::async_trait;
use candid::Deserialize;
use ic_cdk::call::RejectCode;
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
    async fn deposit_account(&self) -> Result<Account, (RejectCode, String)>;
    async fn deposit(&self, amount: u128) -> Result<u128, (RejectCode, String)>;
    async fn swap(&self, amount: u128, min_amount_out: u128) -> Result<Result<SwapSuccess, String>, (RejectCode, String)>;
    async fn withdraw(&self, successful_swap: bool, amount: u128) -> Result<u128, (RejectCode, String)>;
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SwapSuccess {
    pub amount_out: u128,
    pub withdrawal_success: Option<bool>,
}
