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
        logo: Option<String>,
        nervous_system: Option<NervousSystem>,
        info_url: Option<String>,
        how_to_buy_url: Option<String>,
        transaction_url_format: Option<String>,
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
