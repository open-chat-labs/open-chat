use bridges::{Bridges, Params, generate};
use puzzle_core::cli;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 4 {
        eprintln!("usage: bridges_cli <seed> <w> <h> <easy|tricky> [island_pct] [expansion_pct]");
        std::process::exit(2);
    }
    let seed: u64 = args[0].parse().expect("seed");
    let width: u8 = args[1].parse().expect("width");
    let height: u8 = args[2].parse().expect("height");
    let tier = cli::tier(&args[3]);
    let mut params = Params::default_for(width, height, tier);
    if let Some(s) = args.get(4) {
        params.island_pct = s.parse().expect("island_pct");
    }
    if let Some(s) = args.get(5) {
        params.expansion_pct = s.parse().expect("expansion_pct");
    }

    cli::print::<Bridges>(generate(seed, params));
}
