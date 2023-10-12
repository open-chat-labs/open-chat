use registry_canister::{NervousSystem, TokenDetails};
use serde::{Deserialize, Serialize};
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Tokens {
    last_updated: TimestampMillis,
    tokens: Vec<TokenDetails>,
}

impl Tokens {
    #[allow(clippy::too_many_arguments)]
    pub fn add(
        &mut self,
        ledger_canister_id: CanisterId,
        name: String,
        symbol: String,
        decimals: u8,
        fee: u128,
        logo: String,
        nervous_system: Option<NervousSystem>,
        info_url: String,
        how_to_buy_url: String,
        transaction_url_format: String,
        now: TimestampMillis,
    ) -> bool {
        if self.exists(ledger_canister_id) {
            false
        } else {
            self.tokens.push(TokenDetails {
                ledger_canister_id,
                name,
                symbol,
                decimals,
                fee,
                logo,
                nervous_system,
                info_url,
                how_to_buy_url,
                transaction_url_format,
                added: now,
                last_updated: now,
            });
            self.last_updated = now;
            true
        }
    }

    pub fn get_mut(&mut self, ledger_canister_id: CanisterId) -> Option<&mut TokenDetails> {
        self.tokens.iter_mut().find(|t| t.ledger_canister_id == ledger_canister_id)
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn get_all(&self) -> &[TokenDetails] {
        &self.tokens
    }

    pub fn exists(&self, ledger_canister_id: CanisterId) -> bool {
        self.tokens.iter().any(|t| t.ledger_canister_id == ledger_canister_id)
    }
}

#[derive(Serialize)]
pub struct TokenMetrics {
    ledger_canister_id: CanisterId,
    name: String,
    symbol: String,
    decimals: u8,
    fee: u128,
    logo_length: usize,
    nervous_system: Option<NervousSystem>,
    info_url: String,
    how_to_buy_url: String,
    transaction_url_format: String,
    added: TimestampMillis,
    last_updated: TimestampMillis,
}

impl From<&TokenDetails> for TokenMetrics {
    fn from(value: &TokenDetails) -> Self {
        TokenMetrics {
            ledger_canister_id: value.ledger_canister_id,
            name: value.name.clone(),
            symbol: value.symbol.clone(),
            decimals: value.decimals,
            fee: value.fee,
            logo_length: value.logo.len(),
            nervous_system: value.nervous_system.clone(),
            info_url: value.info_url.clone(),
            how_to_buy_url: value.how_to_buy_url.clone(),
            transaction_url_format: value.transaction_url_format.clone(),
            added: value.added,
            last_updated: value.last_updated,
        }
    }
}
