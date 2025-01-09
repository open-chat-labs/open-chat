use candid::Principal;
use clap::Parser;
use oc_bots_sdk_offchain::agent;
use std::{collections::HashMap, error::Error, fs::File};

mod insert_jokes;

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
    let agent = agent::build(config.url, &config.controller).await;

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
            let args = insert_jokes::Args { jokes: batch };

            make_update_call(&agent, &config.greet_bot_canister_id, "insert_jokes", &args).await?;
        }
    }

    Ok(())
}

async fn make_update_call(
    agent: &ic_agent::Agent,
    canister_id: &Principal,
    method_name: &str,
    args: &insert_jokes::Args,
) -> Result<insert_jokes::Response, Box<dyn std::error::Error + Sync + std::marker::Send>> {
    use candid::{Decode, Encode};

    let candid_args = Encode!(args)?;

    let response = agent
        .update(canister_id, method_name)
        .with_arg(candid_args)
        .call_and_wait()
        .await?;

    let result = Decode!(response.as_slice(), insert_jokes::Response)?;

    Ok(result)
}
