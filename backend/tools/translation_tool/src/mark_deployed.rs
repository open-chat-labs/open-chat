use canister_agent_utils::{build_ic_agent, get_dfx_identity};
use std::{error::Error, fs};
use types::{CanisterId, TimestampMillis};

use crate::Config;

pub async fn run(config: Config) -> Result<(), Box<dyn Error + Send + Sync>> {
    let latest_approval = read_latest_approval(&config.directory).await?;

    mark_approved_translations_as_deployed(
        &config.url,
        &config.controller,
        &config.translations_canister_id,
        latest_approval,
    )
    .await?;

    Ok(())
}

async fn read_latest_approval(directory_path: &str) -> Result<TimestampMillis, Box<dyn Error + Send + Sync>> {
    let text = fs::read_to_string(format!("{directory_path}/latest-approval.txt")).unwrap_or("0".to_string());
    let timestamp: TimestampMillis = serde_json::from_str(&text)?;
    Ok(timestamp)
}

async fn mark_approved_translations_as_deployed(
    url: &str,
    controller: &str,
    translations_canister_id: &CanisterId,
    latest_approval: TimestampMillis,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let identity = get_dfx_identity(controller);
    let agent = build_ic_agent(url.to_string(), identity).await;
    let args = translations_canister::mark_deployed::Args { latest_approval };

    translations_canister_client::mark_deployed(&agent, translations_canister_id, &args).await?;

    Ok(())
}
