use candid::Principal;
use registry_canister::token_details::TokenDetails;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Tokens {
    tokens: Vec<TokenDetailsInternal>,
}

impl Tokens {
    pub fn add(
        &mut self,
        ledger_canister_id: CanisterId,
        name: String,
        symbol: String,
        decimals: u8,
        fee: u128,
        info_url: Option<String>,
        transaction_url_format: Option<String>,
        now: TimestampMillis,
    ) -> bool {
        if self.exists(ledger_canister_id) {
            false
        } else {
            self.tokens.push(TokenDetailsInternal {
                ledger_canister_id,
                name,
                symbol,
                decimals,
                fee,
                info_url,
                transaction_url_format,
                added: now,
                last_updated: now,
            });
            true
        }
    }

    pub fn get(&self, filter: Option<HashSet<Principal>>) -> Vec<TokenDetails> {
        self.tokens
            .iter()
            .filter(|t| filter.as_ref().map_or(true, |l| l.contains(&t.ledger_canister_id)))
            .map(|t| t.into())
            .collect()
    }

    pub fn exists(&self, ledger_canister_id: CanisterId) -> bool {
        self.tokens.iter().any(|t| t.ledger_canister_id == ledger_canister_id)
    }
}

#[derive(Serialize, Deserialize)]
struct TokenDetailsInternal {
    #[serde(rename = "l")]
    pub ledger_canister_id: CanisterId,
    #[serde(rename = "n")]
    pub name: String,
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "d")]
    pub decimals: u8,
    #[serde(rename = "f")]
    pub fee: u128,
    #[serde(rename = "i")]
    pub info_url: Option<String>,
    #[serde(rename = "t")]
    pub transaction_url_format: Option<String>,
    #[serde(rename = "a")]
    pub added: TimestampMillis,
    #[serde(rename = "up")]
    pub last_updated: TimestampMillis,
}

impl From<&TokenDetailsInternal> for TokenDetails {
    fn from(value: &TokenDetailsInternal) -> Self {
        TokenDetails {
            ledger_canister_id: value.ledger_canister_id,
            name: value.name.clone(),
            symbol: value.symbol.clone(),
            decimals: value.decimals,
            fee: value.fee,
            info_url: value.info_url.clone(),
            transaction_url_format: value.transaction_url_format.clone(),
            last_updated: value.last_updated,
        }
    }
}
