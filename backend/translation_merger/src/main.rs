use clap::Parser;
use std::process;
use translation_merger::merge;
use translation_merger::Config;

#[tokio::main]
async fn main() {
    let config = Config::parse();

    if let Err(e) = merge(config).await {
        eprintln!("Application error: {e}");
        process::exit(1);
    }
}
