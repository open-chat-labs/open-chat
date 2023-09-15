use async_trait::async_trait;
use exchange_bot_canister::ExchangeId;
use ic_cdk::api::call::CallResult;
use types::icrc1::Account;
use types::{CanisterId, TokenInfo};

pub trait SwapClientFactory {
    fn build(
        &self,
        this_canister_id: CanisterId,
        input_token: TokenInfo,
        output_token: TokenInfo,
    ) -> Option<Box<dyn SwapClient>>;
}

#[async_trait]
pub trait SwapClient {
    fn exchange_id(&self) -> ExchangeId;
    async fn quote(&self, amount: u128) -> CallResult<u128>;
    async fn deposit_account(&self) -> CallResult<(CanisterId, Account)>;
    async fn deposit(&self, amount: u128) -> CallResult<u128>;
    async fn swap(&self, amount: u128) -> CallResult<u128>;
    async fn withdraw(&self, amount: u128) -> CallResult<u128>;
}
