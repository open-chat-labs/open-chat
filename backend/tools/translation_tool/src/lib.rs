use clap::Parser;
use std::error::Error;
use types::CanisterId;

mod mark_deployed;
mod merge_latest_approved;

#[derive(Parser, Debug)]
pub struct Config {
    /// "merge" or "mark-deployed"
    #[arg(long)]
    action: String,

    /// The id of the Translations canister
    #[arg(long)]
    translations_canister_id: CanisterId,

    /// IC URL
    #[arg(long)]
    url: String,

    /// The DFX identity of controller
    #[arg(long)]
    controller: String,

    /// The path to the translation files
    #[arg(long)]
    directory: String,
}

pub async fn run(config: Config) -> Result<(), Box<dyn Error + Send + Sync>> {
    if config.action == "merge" {
        merge_latest_approved::run(config).await
    } else if config.action == "mark-deployed" {
        mark_deployed::run(config).await
    } else {
        Err("Unsupported command")?
    }
}
