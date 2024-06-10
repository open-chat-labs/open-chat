use candid::Principal;
use clap::Parser;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use std::error::Error;

#[derive(Parser, Debug)]
pub struct Config {
    #[arg(long)]
    principal: String,
}

pub fn run(config: Config) -> Result<String, Box<dyn Error>> {
    let principal = Principal::from_text(config.principal)?;
    let acct_id = AccountIdentifier::new(&principal, &DEFAULT_SUBACCOUNT);
    Ok(acct_id.to_string())
}
