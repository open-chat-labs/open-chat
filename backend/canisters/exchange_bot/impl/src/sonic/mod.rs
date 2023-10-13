use crate::swap_client::{SwapClient, SwapClientFactory};
use async_trait::async_trait;
use exchange_bot_canister::ExchangeId;
use ic_cdk::api::call::CallResult;
use sonic_client::SonicClient;
use types::icrc1::Account;
use types::{CanisterId, Cryptocurrency, TokenInfo};

pub fn sonic_canister_id() -> CanisterId {
    CanisterId::from_text("3xwpq-ziaaa-aaaah-qcn4a-cai").unwrap()
}

pub struct SonicClientFactory {
    sonic_canister_id: CanisterId,
    deposit_subaccount: [u8; 32],
}

impl SonicClientFactory {
    pub fn new(deposit_subaccount: [u8; 32]) -> SonicClientFactory {
        SonicClientFactory {
            sonic_canister_id: sonic_canister_id(),
            deposit_subaccount,
        }
    }
}

impl SwapClientFactory for SonicClientFactory {
    fn build(
        &self,
        this_canister_id: CanisterId,
        input_token: &TokenInfo,
        output_token: &TokenInfo,
    ) -> Option<Box<dyn SwapClient>> {
        match (&input_token.token, &output_token.token) {
            (Cryptocurrency::CHAT, Cryptocurrency::InternetComputer) => Some(Box::new(SonicClient::new(
                this_canister_id,
                self.sonic_canister_id,
                input_token.clone(),
                output_token.clone(),
                true,
                self.deposit_subaccount,
            ))),
            (Cryptocurrency::InternetComputer, Cryptocurrency::CHAT) => Some(Box::new(SonicClient::new(
                this_canister_id,
                self.sonic_canister_id,
                output_token.clone(),
                input_token.clone(),
                false,
                self.deposit_subaccount,
            ))),
            _ => None,
        }
    }
}

#[async_trait]
impl SwapClient for SonicClient {
    fn exchange_id(&self) -> ExchangeId {
        ExchangeId::Sonic
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
        self.deposit_account().await
    }

    async fn deposit(&self, amount: u128) -> CallResult<()> {
        self.deposit(amount - self.input_token().fee).await.map(|_| ())
    }

    async fn swap(&self, amount: u128) -> CallResult<u128> {
        self.swap(amount).await
    }

    async fn withdraw(&self, amount: u128) -> CallResult<u128> {
        self.withdraw(amount).await
    }
}
