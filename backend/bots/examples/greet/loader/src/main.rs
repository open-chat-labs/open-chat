use clap::Parser;
use joke_uploader::run;
use joke_uploader::Config;
use std::process;

#[tokio::main]
async fn main() {
    let config = Config::parse();

    if let Err(e) = run(config).await {
        eprintln!("Application error: {e}");
        process::exit(1);
    }
}
