use dataurl::DataUrl;
use registry_canister::{Payment, TokenDetails};
use serde::{Deserialize, Serialize};
use sha256::sha256;
use tracing::info;
use types::{CanisterId, EvmContractAddress, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Tokens {
    pub last_updated: TimestampMillis,
    tokens: Vec<TokenDetails>,
}

impl Tokens {
    #[expect(clippy::too_many_arguments)]
    pub fn add(
        &mut self,
        ledger_canister_id: CanisterId,
        index_canister_id: Option<CanisterId>,
        name: String,
        symbol: String,
        decimals: u8,
        fee: u128,
        logo: String,
        info_url: String,
        transaction_url_format: String,
        supported_standards: Vec<String>,
        payment: Option<Payment>,
        one_sec_enabled: bool,
        evm_contract_addresses: Vec<EvmContractAddress>,
        now: TimestampMillis,
    ) -> bool {
        if self.exists(ledger_canister_id) {
            false
        } else {
            // If there is an existing token with the same symbol, disable it in favour of the
            // newly added one
            if let Some(matching_symbol) = self.tokens.iter_mut().find(|t| t.symbol == symbol) {
                matching_symbol.enabled = false;
                matching_symbol.last_updated = now;
            }

            let logo_id = logo_id(&logo);
            self.tokens.push(TokenDetails {
                ledger_canister_id,
                index_canister_id,
                name,
                symbol,
                decimals,
                fee,
                logo,
                logo_id,
                info_url,
                transaction_url_format,
                supported_standards,
                added: now,
                enabled: true,
                last_updated: now,
                payments: payment.into_iter().collect(),
                one_sec_enabled,
                evm_contract_addresses,
                uninstalled: false,
            });
            self.last_updated = now;
            info!(%ledger_canister_id, "Added token");
            true
        }
    }

    pub fn update(&mut self, args: registry_canister::update_token::Args, now: TimestampMillis) -> bool {
        self.apply_update(
            args.ledger_canister_id,
            |t| {
                if let Some(name) = args.name {
                    t.name = name;
                }
                if let Some(symbol) = args.symbol {
                    t.symbol = symbol;
                }
                if let Some(info_url) = args.info_url {
                    t.info_url = info_url;
                }
                if let Some(transaction_url_format) = args.transaction_url_format {
                    t.transaction_url_format = transaction_url_format;
                }
                if let Some(logo) = args.logo {
                    t.logo_id = logo_id(&logo);
                    t.logo = logo;
                }
                if let Some(fee) = args.fee {
                    t.fee = fee;
                }
                info!(ledger_canister_id = %args.ledger_canister_id, "Token details updated");
                true
            },
            now,
        )
    }

    pub fn set_standards(&mut self, ledger_canister_id: CanisterId, supported_standards: Vec<String>, now: TimestampMillis) {
        self.apply_update(
            ledger_canister_id,
            |t| {
                if t.supported_standards != supported_standards {
                    t.supported_standards = supported_standards;
                    info!(%ledger_canister_id, "Updated token standards");
                    true
                } else {
                    false
                }
            },
            now,
        );
    }

    pub fn set_enabled(&mut self, ledger_canister_id: CanisterId, enabled: bool, now: TimestampMillis) {
        self.apply_update(
            ledger_canister_id,
            |t| {
                if t.enabled != enabled {
                    t.enabled = enabled;
                    if enabled {
                        info!(%ledger_canister_id, "Set token enabled");
                    } else {
                        info!(%ledger_canister_id, "Set token disabled");
                    }
                    true
                } else {
                    false
                }
            },
            now,
        );
    }

    pub fn set_index_canister(&mut self, ledger_canister_id: CanisterId, index_canister_id: CanisterId, now: TimestampMillis) {
        self.apply_update(
            ledger_canister_id,
            |t| {
                t.index_canister_id = Some(index_canister_id);
                info!(%ledger_canister_id, ?index_canister_id, "Set token index canister");
                true
            },
            now,
        );
    }

    pub fn mark_uninstalled(&mut self, ledger_canister_id: CanisterId, now: TimestampMillis) {
        self.apply_update(
            ledger_canister_id,
            |t| {
                t.uninstalled = true;
                info!(%ledger_canister_id, "Marked token uninstalled");
                true
            },
            now,
        );
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn iter(&self) -> impl Iterator<Item = &TokenDetails> {
        self.tokens.iter()
    }

    pub fn exists(&self, ledger_canister_id: CanisterId) -> bool {
        self.get(ledger_canister_id).is_some()
    }

    pub fn get(&self, ledger_canister_id: CanisterId) -> Option<&TokenDetails> {
        self.tokens.iter().find(|t| t.ledger_canister_id == ledger_canister_id)
    }

    fn apply_update<F: FnOnce(&mut TokenDetails) -> bool>(
        &mut self,
        ledger_canister_id: CanisterId,
        update_fn: F,
        now: TimestampMillis,
    ) -> bool {
        if let Some(token) = self.tokens.iter_mut().find(|t| t.ledger_canister_id == ledger_canister_id)
            && update_fn(token)
        {
            token.last_updated = now;
            self.last_updated = now;
            return true;
        }
        false
    }
}

fn logo_id(logo: &str) -> Option<u128> {
    DataUrl::parse(logo)
        .is_ok()
        .then(|| u128::from_be_bytes(sha256(logo.as_bytes())[..16].try_into().unwrap()))
}

#[derive(Serialize)]
pub struct TokenMetrics {
    ledger_canister_id: CanisterId,
    index_canister_id: Option<CanisterId>,
    name: String,
    symbol: String,
    decimals: u8,
    fee: u128,
    logo_length: usize,
    logo_id: Option<u128>,
    info_url: String,
    transaction_url_format: String,
    supported_standards: Vec<String>,
    added: TimestampMillis,
    enabled: bool,
    uninstalled: bool,
    last_updated: TimestampMillis,
    payments: Vec<Payment>,
    one_sec_enabled: bool,
    evm_contract_addresses: Vec<EvmContractAddress>,
}

impl From<&TokenDetails> for TokenMetrics {
    fn from(value: &TokenDetails) -> Self {
        TokenMetrics {
            ledger_canister_id: value.ledger_canister_id,
            index_canister_id: value.index_canister_id,
            name: value.name.clone(),
            symbol: value.symbol.clone(),
            decimals: value.decimals,
            fee: value.fee,
            logo_length: value.logo.len(),
            logo_id: value.logo_id,
            info_url: value.info_url.clone(),
            transaction_url_format: value.transaction_url_format.clone(),
            supported_standards: value.supported_standards.clone(),
            added: value.added,
            enabled: value.enabled,
            uninstalled: value.uninstalled,
            last_updated: value.last_updated,
            payments: value.payments.clone(),
            one_sec_enabled: value.one_sec_enabled,
            evm_contract_addresses: value.evm_contract_addresses.clone(),
        }
    }
}
