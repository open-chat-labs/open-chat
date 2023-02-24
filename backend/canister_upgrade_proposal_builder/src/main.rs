use canister_upgrade_proposal_builder::build;
use canister_upgrade_proposal_builder::Config;
use clap::Parser;
use std::io;
use std::io::Write;
use std::process;

fn main() {
    let config = Config::parse();

    if let Err(e) = build(config).and_then(|blob| {
        let mut stdout = io::stdout();
        Ok(stdout.write_all(&blob)?)
    }) {
        eprintln!("Application error: {e}");
        process::exit(1);
    }
}
