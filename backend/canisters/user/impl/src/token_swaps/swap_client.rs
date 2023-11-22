use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use icrc_ledger_types::icrc1::account::Account;

#[async_trait]
pub trait SwapClient {
    async fn deposit_account(&self) -> CallResult<Account>;
    async fn deposit(&self, amount: u128) -> CallResult<()>;
    async fn swap(&self, amount: u128, min_amount_out: u128) -> CallResult<u128>;
    async fn withdraw(&self, amount: u128) -> CallResult<u128>;
}
