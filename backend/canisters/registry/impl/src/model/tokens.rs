use registry_canister::TokenDetails;
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
        info_url: String,
        how_to_buy_url: String,
        transaction_url_format: String,
        supported_standards: Vec<String>,
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
                info_url,
                how_to_buy_url,
                transaction_url_format,
                supported_standards,
                added: now,
                enabled: true,
                last_updated: now,
            });
            self.last_updated = now;
            true
        }
    }

    pub fn update(&mut self, args: registry_canister::update_token::Args, now: TimestampMillis) -> bool {
        if let Some(token) = self.get_token_mut(args.ledger_canister_id) {
            if let Some(name) = args.name {
                token.name = name;
            }
            if let Some(symbol) = args.symbol {
                token.symbol = symbol;
            }
            if let Some(info_url) = args.info_url {
                token.info_url = info_url;
            }
            if let Some(how_to_buy_url) = args.how_to_buy_url {
                token.how_to_buy_url = how_to_buy_url;
            }
            if let Some(transaction_url_format) = args.transaction_url_format {
                token.transaction_url_format = transaction_url_format;
            }
            if let Some(logo) = args.logo {
                token.logo = logo;
            }
            token.last_updated = now;
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn set_standards(&mut self, ledger_canister_id: CanisterId, supported_standards: Vec<String>, now: TimestampMillis) {
        if let Some(token) = self.get_token_mut(ledger_canister_id) {
            if token.supported_standards != supported_standards {
                token.supported_standards = supported_standards;
                token.last_updated = now;
            }
        }
    }

    #[allow(dead_code)]
    pub fn set_fee(&mut self, ledger_canister_id: CanisterId, fee: u128, now: TimestampMillis) {
        if let Some(token) = self.get_token_mut(ledger_canister_id) {
            if token.fee != fee {
                token.fee = fee;
                token.last_updated = now;
                self.last_updated = now;
            }
        }
    }

    pub fn set_enabled(&mut self, ledger_canister_id: CanisterId, enabled: bool, now: TimestampMillis) {
        if let Some(token) = self.get_token_mut(ledger_canister_id) {
            if token.enabled != enabled {
                token.enabled = enabled;
                token.last_updated = now;
            }
        }
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

    fn get_token_mut(&mut self, ledger_canister_id: CanisterId) -> Option<&mut TokenDetails> {
        self.tokens.iter_mut().find(|t| t.ledger_canister_id == ledger_canister_id)
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
    info_url: String,
    how_to_buy_url: String,
    transaction_url_format: String,
    supported_standards: Vec<String>,
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
            info_url: value.info_url.clone(),
            how_to_buy_url: value.how_to_buy_url.clone(),
            transaction_url_format: value.transaction_url_format.clone(),
            supported_standards: value.supported_standards.clone(),
            added: value.added,
            last_updated: value.last_updated,
        }
    }
}
