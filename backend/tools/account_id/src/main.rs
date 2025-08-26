use account_id::{Config, run};
use clap::Parser;

fn main() {
    let config = Config::parse();

    match run(config) {
        Ok(acct_id) => println!("{acct_id}"),
        Err(e) => eprintln!("Application error: {e}"),
    }
}
