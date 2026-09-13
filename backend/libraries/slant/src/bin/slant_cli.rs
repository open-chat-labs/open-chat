use puzzle_core::cli;
use slant::{Params, Slant, generate};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 4 {
        eprintln!("usage: slant_cli <seed> <w> <h> <easy|tricky>");
        std::process::exit(2);
    }
    let seed: u64 = args[0].parse().expect("seed");
    let width: u8 = args[1].parse().expect("width");
    let height: u8 = args[2].parse().expect("height");
    let tier = cli::tier(&args[3]);

    cli::print::<Slant>(generate(seed, Params::default_for(width, height, tier)));
}
