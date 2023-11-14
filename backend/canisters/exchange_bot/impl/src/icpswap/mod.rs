use crate::swap_client::{SwapClient, SwapClientFactory};
use async_trait::async_trait;
use exchange_bot_canister::ExchangeId;
use ic_cdk::api::call::CallResult;
use icpswap_client::ICPSwapClient;
use icrc_ledger_types::icrc1::account::Account;
use types::{CanisterId, Cryptocurrency, TokenInfo};

pub struct ICPSwapClientFactory {}

impl ICPSwapClientFactory {
    pub fn new() -> ICPSwapClientFactory {
        ICPSwapClientFactory {}
    }

    fn lookup_swap_canister_id(&self, token0: &TokenInfo, token1: &TokenInfo) -> Option<CanisterId> {
        match (token0.token.clone(), token1.token.clone()) {
            (Cryptocurrency::CHAT, Cryptocurrency::InternetComputer) => {
                Some(CanisterId::from_text("ne2vj-6yaaa-aaaag-qb3ia-cai").unwrap())
            }
            _ => None,
        }
    }
}

impl SwapClientFactory for ICPSwapClientFactory {
    fn build(
        &self,
        this_canister_id: CanisterId,
        input_token: TokenInfo,
        output_token: TokenInfo,
    ) -> Option<Box<dyn SwapClient>> {
        if let Some(swap_canister_id) = self.lookup_swap_canister_id(&input_token, &output_token) {
            Some(Box::new(ICPSwapClient::new(
                this_canister_id,
                swap_canister_id,
                input_token.clone(),
                output_token.clone(),
                true,
            )))
        } else if let Some(swap_canister_id) = self.lookup_swap_canister_id(&output_token, &input_token) {
            Some(Box::new(ICPSwapClient::new(
                this_canister_id,
                swap_canister_id,
                output_token.clone(),
                input_token.clone(),
                false,
            )))
        } else {
            None
        }
    }
}

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
