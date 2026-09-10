use light_up::{
    Cell, Generated, Params, Symmetry, Tier, Violation, check_rules, count_solutions, generate, parse_description,
    render_ascii, solution_pairs, solve_with_trace,
};
use std::collections::BTreeMap;

const SEEDS_PER_CONFIG: u64 = 200;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    let symmetry = if width == height { Symmetry::Rot4 } else { Symmetry::Rot2 };
    Params {
        width,
        height,
        black_pct: 20,
        symmetry,
        tier,
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn replay_hints(g: &Generated) -> Vec<u8> {
    let d = parse_description(&g.description).unwrap();
    let mut grid = vec![0u8; d.width as usize * d.height as usize];
    let mut no_bulb = vec![false; grid.len()];
    for hint in &g.hints {
        for &(cell, value) in &hint.conclusions {
            let cell = cell as usize;
            if value == 1 {
                assert!(!no_bulb[cell], "hint places a bulb on a cell already ruled out");
                grid[cell] = 1;
            } else {
                assert_eq!(grid[cell], 0, "hint rules out a cell that already holds a bulb");
                no_bulb[cell] = true;
            }
        }
    }
    grid
}

/// `pairs` is the solution over exactly the white cells, and every hint
/// conclusion agrees with it. Hints only conclude bulbs and cells ruled
/// out by a clue or set exclusion; a cell that is merely lit gets no
/// conclusion, so the replay covers a subset of the keys.
fn check_pairs(g: &Generated, ctx: &str) {
    let d = parse_description(&g.description).unwrap();
    assert_eq!(g.pairs, solution_pairs(&g.description, &g.solution), "{ctx}: pairs");
    let keys: Vec<u16> = g.pairs.iter().map(|&(k, _)| k).collect();
    let white: Vec<u16> = (0..d.cells.len() as u16)
        .filter(|&i| d.cells[i as usize] == Cell::White)
        .collect();
    assert_eq!(keys, white, "{ctx}: pairs keys are not the white cells");
    let pairs: BTreeMap<u16, u8> = g.pairs.iter().copied().collect();
    let mut replayed = BTreeMap::new();
    for hint in &g.hints {
        for &(k, v) in &hint.conclusions {
            replayed.insert(k, v);
        }
    }
    for (k, v) in &replayed {
        assert_eq!(
            pairs.get(k),
            Some(v),
            "{ctx}: hint conclusion for cell {k} disagrees with pairs"
        );
    }
    let bulbs = |m: &BTreeMap<u16, u8>| m.values().filter(|&&v| v == 1).count();
    assert_eq!(
        bulbs(&replayed),
        bulbs(&pairs),
        "{ctx}: hints place a different number of bulbs"
    );
}

fn check_generated(seed: u64, p: Params) {
    let g = generate(seed, p);
    let ctx = format!("seed {seed} {}x{} {:?}", p.width, p.height, p.tier);

    assert_eq!(g.tier, p.tier, "{ctx}");
    assert_eq!(count_solutions(&g.description, 2), 1, "{ctx}: not unique");
    assert!(
        check_rules(&g.description, &g.solution).is_empty(),
        "{ctx}: solution breaks rules"
    );

    let (hints, solved) = solve_with_trace(&g.description, p.tier);
    assert_eq!(
        solved.as_deref(),
        Some(g.solution.as_slice()),
        "{ctx}: solver disagrees with solution"
    );
    assert_eq!(hints, g.hints, "{ctx}: trace differs from stored hints");
    assert!(!g.hints.is_empty(), "{ctx}: no hints");

    for hint in &g.hints {
        assert!(!hint.focus.is_empty(), "{ctx}: empty focus");
        assert!(!hint.target.is_empty(), "{ctx}: empty target");
        for t in &hint.target {
            assert!(hint.focus.contains(t), "{ctx}: target {t} not in focus");
        }
        assert!(!hint.conclusions.is_empty(), "{ctx}: empty conclusions");
        for &(cell, value) in &hint.conclusions {
            assert_eq!(g.solution[cell as usize], value, "{ctx}: conclusion disagrees with solution");
        }
    }
    assert_eq!(
        replay_hints(&g),
        g.solution,
        "{ctx}: replaying hints does not reach the solution"
    );
    check_pairs(&g, &ctx);

    if p.tier == Tier::Tricky {
        assert!(
            solve_with_trace(&g.description, Tier::Easy).1.is_none(),
            "{ctx}: easy solver finished a tricky puzzle"
        );
    }
}

#[test]
fn generated_7x7_easy() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(7, 7, Tier::Easy));
    }
}

#[test]
fn generated_7x7_tricky() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(7, 7, Tier::Tricky));
    }
}

#[test]
fn generated_10x10_easy() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(10, 10, Tier::Easy));
    }
}

#[test]
fn generated_10x10_tricky() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(10, 10, Tier::Tricky));
    }
}

#[test]
fn single_cell_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(7, 7, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p);
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] ^= 1;
            assert!(
                !check_rules(&g.description, &grid).is_empty(),
                "seed {seed}: flipping cell {i} went unnoticed"
            );
        }
    }
}

#[test]
fn generation_is_deterministic() {
    for (w, h, tier) in [(7, 7, Tier::Easy), (10, 10, Tier::Tricky)] {
        let a = generate(7, params(w, h, tier));
        let b = generate(7, params(w, h, tier));
        assert_eq!(a.description, b.description);
        assert_eq!(a.solution, b.solution);
        assert_eq!(a.hints, b.hints);
    }
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42, 7x7, 20% black, Rot4, Easy. Any change
    // here means the wire encoding or the generator's RNG stream drifted.
    const DESCRIPTION_HEX: &str =
        "01070700000000001000100011120000000000000000130000110000001000001100000000000000001014001000100000000000";
    const SOLUTION_HEX: &str =
        "00010000000000000000000001000000000100000100000000000000000000000100000000010000010001000000010000";
    let g = generate(42, params(7, 7, Tier::Easy));
    assert_eq!(hex(&g.description), DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), SOLUTION_HEX);
}

#[test]
fn parse_rejects_bad_input() {
    let good = generate(1, params(7, 7, Tier::Easy)).description;
    assert!(parse_description(&good).is_ok());

    let mut wrong_version = good.clone();
    wrong_version[0] = 2;
    assert!(parse_description(&wrong_version).is_err());

    let mut short = good.clone();
    short.pop();
    assert!(parse_description(&short).is_err());
    let mut long = good.clone();
    long.push(0);
    assert!(parse_description(&long).is_err());
    assert!(parse_description(&[]).is_err());

    for bad in [0x01, 0x0f, 0x16, 0xff] {
        let mut bytes = good.clone();
        bytes[3] = bad;
        assert!(parse_description(&bytes).is_err(), "cell byte {bad:#04x} accepted");
    }

    let d = parse_description(&good).unwrap();
    assert_eq!(d.cells.len(), 49);
    assert!(d.cells.iter().any(|c| matches!(c, Cell::Black(_))));
}

#[test]
fn render_ascii_has_one_line_per_row() {
    let g = generate(3, params(10, 7, Tier::Easy));
    let puzzle = render_ascii(&g.description, None);
    let solved = render_ascii(&g.description, Some(&g.solution));
    assert_eq!(puzzle.lines().count(), 7);
    assert_eq!(solved.lines().count(), 7);
    assert!(puzzle.lines().all(|l| l.len() == 10));
    assert!(solved.contains('O'));
    assert!(!solved.contains('.'), "solved grid should have no unlit cells");
}

#[test]
fn check_rules_reports_each_violation_kind() {
    let g = generate(5, params(7, 7, Tier::Easy));
    let d = parse_description(&g.description).unwrap();
    let black = d.cells.iter().position(|c| matches!(c, Cell::Black(_))).unwrap();
    let mut grid = g.solution.clone();
    grid[black] = 1;
    assert!(check_rules(&g.description, &grid).contains(&Violation::BulbOnBlack { cell: black as u16 }));

    let empty = vec![0u8; grid.len()];
    let violations = check_rules(&g.description, &empty);
    assert!(violations.iter().any(|v| matches!(v, Violation::Unlit { .. })));
    assert!(violations.iter().any(|v| matches!(v, Violation::ClueCount { actual: 0, .. })));
    assert!(
        !violations
            .iter()
            .any(|v| matches!(v, Violation::BulbSeesBulb { .. } | Violation::BulbOnBlack { .. }))
    );

    let mut seeing = g.solution.clone();
    let bulb = seeing.iter().position(|&b| b == 1).unwrap();
    let right = bulb + 1;
    if right % 7 != 0 && matches!(d.cells[right], Cell::White) {
        seeing[right] = 1;
        assert!(check_rules(&g.description, &seeing).contains(&Violation::BulbSeesBulb {
            a: bulb as u16,
            b: right as u16
        }));
    }
}
