use candid::Principal;
use canister_agent_utils::{build_ic_agent, get_dfx_identity};
use clap::Parser;
use std::{collections::HashMap, error::Error, fs::File};

#[derive(Parser, Debug)]
pub struct Config {
    /// The path of the jokes CSV file
    #[arg(long)]
    file_path: String,

    /// The id of the Greet bot canister
    #[arg(long)]
    greet_bot_canister_id: Principal,

    /// IC URL
    #[arg(long)]
    url: String,

    /// The DFX identity of controller
    #[arg(long)]
    controller: String,
}

#[derive(Debug, serde::Deserialize)]
struct Record {
    id: u32,
    joke: String,
}

pub async fn run(config: Config) -> Result<(), Box<dyn Error + Send + Sync>> {
    // Create an IC agent
    let identity = get_dfx_identity(&config.controller);
    let agent = build_ic_agent(config.url, identity).await;

    // Load the jokes from the CSV file
    let mut jokes: HashMap<u32, String> = HashMap::new();
    let file = File::open(config.file_path)?;
    let mut rdr = csv::Reader::from_reader(file);

    for result in rdr.deserialize() {
        let record: Record = result?;
        jokes.insert(record.id, record.joke);

        // Upload the jokes to the Greet bot canister in batches
        if jokes.len() % 10_000 == 0 {
            let batch = std::mem::take(&mut jokes);
            let args = greet_bot_canister::insert_jokes::Args { jokes: batch };

            greet_bot_canister_client::insert_jokes(&agent, &config.greet_bot_canister_id, &args).await?;
        }
    }

    Ok(())
}
