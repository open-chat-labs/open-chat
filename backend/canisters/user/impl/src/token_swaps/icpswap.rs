use super::swap_client::SwapClient;
use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use icpswap_client::ICPSwapClient;
use icrc_ledger_types::icrc1::account::Account;

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
