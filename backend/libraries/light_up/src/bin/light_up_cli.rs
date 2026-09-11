use light_up::{LightUp, Params, Symmetry, Tier, generate};
use puzzle_core::cli;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 4 {
        eprintln!("usage: light_up_cli <seed> <w> <h> <easy|tricky> [black_pct] [none|rot2|rot4|ref2|ref4]");
        std::process::exit(2);
    }
    let seed: u64 = args[0].parse().expect("seed");
    let width: u8 = args[1].parse().expect("width");
    let height: u8 = args[2].parse().expect("height");
    let tier: Tier = cli::tier(&args[3]);
    let mut params = Params::default_for(width, height, tier);
    if let Some(pct) = args.get(4) {
        params.black_pct = pct.parse().expect("black_pct");
    }
    if let Some(symmetry) = args.get(5) {
        params.symmetry = match symmetry.as_str() {
            "rot2" => Symmetry::Rot2,
            "none" => Symmetry::None,
            "rot4" => Symmetry::Rot4,
            "ref2" => Symmetry::Ref2,
            "ref4" => Symmetry::Ref4,
            other => panic!("unknown symmetry {other}"),
        };
    }

    cli::print::<LightUp>(generate(seed, params));
}
