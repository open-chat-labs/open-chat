use build_upgrade_canister_proposal_arg::run;
use build_upgrade_canister_proposal_arg::Config;
use clap::Parser;
use std::process;

fn main() {
    let config = Config::parse();

    if let Err(e) = run(config) {
        eprintln!("Application error: {e}");
        process::exit(1);
    }
}
