use registry_canister::updates::TokenDetails;
use serde::{Deserialize, Serialize};
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Tokens {
    last_updated: TimestampMillis,
    tokens: Vec<TokenDetailsInternal>,
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
        info_url: Option<String>,
        how_to_buy_url: Option<String>,
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
                how_to_buy_url,
                transaction_url_format,
                added: now,
                last_updated: now,
            });
            self.last_updated = now;
            true
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn get_all(&self) -> Vec<TokenDetails> {
        self.tokens.iter().map(|t| t.into()).collect()
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
    #[serde(rename = "h")]
    pub how_to_buy_url: Option<String>,
    #[serde(rename = "t")]
    pub transaction_url_format: Option<String>,
    #[serde(rename = "a")]
    pub added: TimestampMillis,
    #[serde(rename = "u")]
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
            how_to_buy_url: value.how_to_buy_url.clone(),
            transaction_url_format: value.transaction_url_format.clone(),
            last_updated: value.last_updated,
        }
    }
}
