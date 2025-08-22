use crate::Token;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::{Chain, EvmChain};

pub type Response = Result<Metadata, String>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Metadata {
    pub stable_memory_bytes: u64,
    pub wasm_memory_bytes: u64,
    pub event_count: u64,
    pub ecdsa: Option<EcdsaMetadata>,
    pub tokens: Vec<TokenMetadata>,
    pub cycle_balance: Nat,
    pub evm_chains: Vec<EvmChainMetadata>,
    pub last_upgrade_time: u64,
    pub event_bytes: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EcdsaMetadata {
    chain_code_hex: String,
    public_key_pem: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EvmChainMetadata {
    max_fee_per_gas_average: u64,
    max_priority_fee_per_gas: u64,
    fetch_time_safe_ms: Option<u64>,
    chain: Option<EvmChain>,
    fetch_time_latest_ms: Option<u64>,
    max_fee_per_gas: u64,
    chain_id: u64,
    block_number_safe: Option<u64>,
    nonce: u64,
    max_priority_fee_per_gas_average: u64,
    block_time_ms: u64,
    block_number_latest: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenMetadata {
    pub wei_per_token: f64,
    pub decimals: u8,
    pub token: Option<Token>,
    pub balance: Nat,
    pub contract: String,
    pub queue_size: u64,
    pub chain: Option<Chain>,
    pub locker: Option<String>,
    pub topics: Vec<ByteBuf>,
}
