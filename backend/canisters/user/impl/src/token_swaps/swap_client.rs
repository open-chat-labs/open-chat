use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use icrc_ledger_types::icrc1::account::Account;
use types::{CanisterId, ExchangeId, TokenInfo};

#[async_trait]
pub trait SwapClient {
    fn exchange_id(&self) -> ExchangeId;
    fn input_token(&self) -> &TokenInfo;
    fn output_token(&self) -> &TokenInfo;
    async fn quote(&self, amount: u128) -> CallResult<u128>;
    async fn deposit_account(&self) -> CallResult<(CanisterId, Account)>;
    async fn deposit(&self, amount: u128) -> CallResult<()>;
    async fn swap(&self, amount: u128) -> CallResult<u128>;
    async fn withdraw(&self, amount: u128) -> CallResult<u128>;
}
