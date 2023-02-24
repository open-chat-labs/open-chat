use candid::Encode;
use clap::Parser;
use ic_sns_governance::pb::v1::{proposal, ExecuteGenericNervousSystemFunction, Proposal};
use std::error::Error;
use std::fs;
use types::{CanisterWasm, UpgradeCanisterWasmArgs, Version};

/// Builds the binary encoded candid representation of an ExecuteGenericNervousSystemFunction proposal
/// for upgrading a canister WASM
#[derive(Parser, Debug)]
pub struct Config {
    /// Title of the proposal
    #[arg(short, long)]
    pub title: String,

    /// Summary of the proposal
    #[arg(short, long)]
    pub summary: String,

    /// URL for the proposal
    #[arg(short, long)]
    pub url: String,

    /// Custom function_id of the proposal
    #[arg(short, long)]
    pub function_id: u64,

    /// Path to the wasm module
    #[arg(short, long)]
    pub wasm_path: std::path::PathBuf,

    /// Version of the wasm module
    #[arg(short, long)]
    pub version: Version,
}

pub fn build(config: Config) -> Result<Vec<u8>, Box<dyn Error>> {
    let proposal = create_proposal(config)?;

    Ok(Encode!(&proposal)?)
}

fn create_proposal(config: Config) -> Result<Proposal, Box<dyn Error>> {
    let wasm_module = fs::read(config.wasm_path)?;

    let args = UpgradeCanisterWasmArgs {
        wasm: CanisterWasm {
            version: config.version,
            module: wasm_module,
        },
        filter: None,
        use_for_new_canisters: None,
    };

    let payload = Encode!(&args)?;

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
