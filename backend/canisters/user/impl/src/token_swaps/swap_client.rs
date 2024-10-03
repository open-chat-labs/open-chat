use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use types::icrc1::Account;

#[async_trait]
pub trait SwapClient {
    async fn deposit_account(&self) -> CallResult<Account>;
    async fn deposit(&self, amount: u128) -> CallResult<()>;
    async fn swap(&self, amount: u128, min_amount_out: u128) -> CallResult<Result<u128, String>>;
    async fn withdraw(&self, successful_swap: bool, amount: u128) -> CallResult<u128>;
}
