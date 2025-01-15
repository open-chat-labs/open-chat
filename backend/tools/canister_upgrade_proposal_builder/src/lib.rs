use candid::Encode;
use canister_agent_utils::CanisterName;
use clap::Parser;
use sha256::sha256;
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

    #[arg(long)]
    pub canister_name: CanisterName,

    /// Path to the wasm module
    #[arg(long)]
    pub wasm_path: std::path::PathBuf,

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
    let wasm_hash = sha256(&wasm_module);
    let filter = None;

    let payload = match config.canister_name {
        CanisterName::UserIndex | CanisterName::GroupIndex | CanisterName::NotificationsIndex => {
            let canister_type = match config.canister_name {
                CanisterName::UserIndex => openchat_installer_canister::CanisterType::UserIndex,
                CanisterName::GroupIndex => openchat_installer_canister::CanisterType::GroupIndex,
                CanisterName::NotificationsIndex => openchat_installer_canister::CanisterType::NotificationsIndex,
                _ => unreachable!(),
            };
            Encode!(&openchat_installer_canister::upgrade_canister::Args {
                canister_type,
                version: config.version,
                wasm_hash,
                filter
            })
        }
        CanisterName::LocalUserIndex
        | CanisterName::LocalGroupIndex
        | CanisterName::User
        | CanisterName::Group
        | CanisterName::Community => {
            Encode!(&UpgradeChunkedCanisterWasmArgs {
                version: config.version,
                wasm_hash,
                filter,
            })
        }
        _ => {
            Encode!(&UpgradeCanisterWasmArgs {
                wasm: CanisterWasm {
                    version: config.version,
                    module: wasm_module.into(),
                },
                filter,
            })
        }
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
