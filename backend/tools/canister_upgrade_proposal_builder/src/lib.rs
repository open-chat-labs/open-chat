use candid::Encode;
use clap::Parser;
use sns_governance_canister::types::{proposal, ExecuteGenericNervousSystemFunction, Proposal};
use std::error::Error;
use std::fs;
use types::{BuildVersion, CanisterWasm, UpgradeCanisterWasmArgs, UpgradeChunkedCanisterWasmArgs};

/// Builds the binary encoded candid representation of an ExecuteGenericNervousSystemFunction proposal
/// for upgrading a canister WASM
#[derive(Parser, Debug)]
pub struct Config {
    /// Title of the proposal
    #[arg(long)]
    pub title: String,

    /// Summary of the proposal
    #[arg(long)]
    pub summary: String,

    /// URL for the proposal
    #[arg(long)]
    pub url: String,

    /// Custom function_id of the proposal
    #[arg(long)]
    pub function_id: u64,

    /// Path to the wasm module
    #[arg(long)]
    pub wasm_path: std::path::PathBuf,

    #[arg(long)]
    pub expected_wasm_hash: String,

    #[arg(long)]
    pub install_from_chunks: bool,

    /// Version of the wasm module
    #[arg(long)]
    pub version: BuildVersion,
}

pub fn build(config: Config) -> Result<Vec<u8>, Box<dyn Error>> {
    let proposal = create_proposal(config)?;

    Ok(Encode!(&proposal)?)
}

fn create_proposal(config: Config) -> Result<Proposal, Box<dyn Error>> {
    let wasm_module = fs::read(config.wasm_path)?;

    let wasm_hash = sha256::sha256(&wasm_module);
    let wasm_hash_hex = hex::encode(wasm_hash);
    if wasm_hash_hex != config.expected_wasm_hash {
        return Err(format!(
            "Wasm hash mismatch. Expected: {}. Actual: {}",
            config.expected_wasm_hash, wasm_hash_hex
        )
        .into());
    }

    let payload = if config.install_from_chunks {
        Encode!(&UpgradeChunkedCanisterWasmArgs {
            version: config.version,
            wasm_hash,
            filter: None,
        })
    } else {
        Encode!(&UpgradeCanisterWasmArgs {
            wasm: CanisterWasm {
                version: config.version,
                module: wasm_module.into(),
            },
            filter: None,
        })
    }?;

    let proposal = Proposal {
        title: config.title,
        summary: config.summary,
        url: config.url,
        action: Some(proposal::Action::ExecuteGenericNervousSystemFunction(
            ExecuteGenericNervousSystemFunction {
                function_id: config.function_id,
                payload,
            },
        )),
    };

    Ok(proposal)
}
