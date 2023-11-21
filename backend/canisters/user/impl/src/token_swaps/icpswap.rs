use super::swap_client::SwapClient;
use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use icpswap_client::ICPSwapClient;
use icrc_ledger_types::icrc1::account::Account;
use types::{CanisterId, ExchangeId, TokenInfo};

#[async_trait]
impl SwapClient for ICPSwapClient {
    fn exchange_id(&self) -> ExchangeId {
        ExchangeId::ICPSwap
    }

    fn input_token(&self) -> &TokenInfo {
        self.input_token()
    }

    fn output_token(&self) -> &TokenInfo {
        self.output_token()
    }

    async fn quote(&self, amount: u128) -> CallResult<u128> {
        self.quote(amount).await
    }

    async fn deposit_account(&self) -> CallResult<(CanisterId, Account)> {
        Ok(self.deposit_account())
    }

    async fn deposit(&self, amount: u128) -> CallResult<()> {
        self.deposit(amount).await.map(|_| ())
    }

    async fn swap(&self, amount: u128) -> CallResult<u128> {
        self.swap(amount).await
    }

    async fn withdraw(&self, amount: u128) -> CallResult<u128> {
        self.withdraw(amount).await
    }
}
