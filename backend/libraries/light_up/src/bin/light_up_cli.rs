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
    let black_pct: u8 = args.get(4).map_or(20, |s| s.parse().expect("black_pct"));
    let symmetry = match args.get(5).map(String::as_str) {
        None | Some("rot2") => Symmetry::Rot2,
        Some("none") => Symmetry::None,
        Some("rot4") => Symmetry::Rot4,
        Some("ref2") => Symmetry::Ref2,
        Some("ref4") => Symmetry::Ref4,
        Some(other) => panic!("unknown symmetry {other}"),
    };

    cli::print::<LightUp>(generate(
        seed,
        Params {
            width,
            height,
            black_pct,
            symmetry,
            tier,
        },
    ));
}
