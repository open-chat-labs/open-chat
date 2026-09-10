use tents::{Params, Tier, generate, render_ascii};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 4 {
        eprintln!("usage: tents_cli <seed> <w> <h> <easy|tricky> [tree_pct]");
        std::process::exit(2);
    }
    let seed: u64 = args[0].parse().expect("seed");
    let width: u8 = args[1].parse().expect("width");
    let height: u8 = args[2].parse().expect("height");
    let tier = match args[3].as_str() {
        "easy" => Tier::Easy,
        "tricky" => Tier::Tricky,
        other => panic!("unknown tier {other}"),
    };
    let mut params = Params::default_for(width, height, tier);
    if let Some(pct) = args.get(4) {
        params.tree_pct = pct.parse().expect("tree_pct");
    }

    let g = generate(seed, params);
    print!("{}", render_ascii(&g.description, None));
    println!();
    print!("{}", render_ascii(&g.description, Some(&g.solution)));
    println!();
    for h in &g.hints {
        println!("{:?} focus={:?} conclusions={:?}", h.technique, h.focus, h.conclusions);
    }
    println!();
    println!("{}", g.description.iter().map(|b| format!("{b:02x}")).collect::<String>());
    println!("{}", g.solution.iter().map(|b| format!("{b:02x}")).collect::<String>());
}
