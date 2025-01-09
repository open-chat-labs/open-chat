use clap::Parser;
use std::process;

use greet_bot_loader::{run, Config};

#[tokio::main]
async fn main() {
    let config = Config::parse();

    if let Err(e) = run(config).await {
        eprintln!("Application error: {e}");
        process::exit(1);
    }
}
