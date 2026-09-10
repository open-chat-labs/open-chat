use std::collections::BTreeMap;
use unruly::{
    EMPTY, Generated, Params, Tier, VALUE_A, VALUE_B, Violation, check_rules, count_solutions, generate, parse_description,
    render_ascii, solution_pairs, solve_with_trace,
};

const SEEDS_PER_CONFIG: u64 = 100;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    Params::default_for(width, height, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Start from the givens (unlike the other games, Unruly's description is
/// itself a partly filled grid) and apply every hint conclusion in order.
fn replay_hints(g: &Generated) -> Vec<u8> {
    let d = parse_description(&g.description).unwrap();
    let mut grid = d.givens.clone();
    for hint in &g.hints {
        for &(cell, value) in &hint.conclusions {
            let cell = cell as usize;
            assert!(value == VALUE_A || value == VALUE_B, "bad conclusion value {value}");
            assert_eq!(grid[cell], EMPTY, "hint fixes cell {cell} twice, or a given");
            grid[cell] = value;
        }
    }
    grid
}

/// `pairs` is the solution over every cell, and the givens plus every hint
/// conclusion make it up exactly.
fn check_pairs(g: &Generated, ctx: &str) {
    assert_eq!(g.pairs, solution_pairs(&g.description, &g.solution), "{ctx}: pairs");
    let keys: Vec<u16> = g.pairs.iter().map(|&(k, _)| k).collect();
    let cells: Vec<u16> = (0..g.solution.len() as u16).collect();
    assert_eq!(keys, cells, "{ctx}: pairs keys are not every cell");

    let pairs: BTreeMap<u16, u8> = g.pairs.iter().copied().collect();
    let d = parse_description(&g.description).unwrap();
    let mut replayed: BTreeMap<u16, u8> = d
        .givens
        .iter()
        .enumerate()
        .filter(|&(_, &v)| v != EMPTY)
        .map(|(i, &v)| (i as u16, v))
        .collect();
    for hint in &g.hints {
        for &(k, v) in &hint.conclusions {
            replayed.insert(k, v);
        }
    }
    assert_eq!(replayed, pairs, "{ctx}: givens plus replayed hints differ from pairs");
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
    assert!(
        g.solution.iter().all(|&b| b == VALUE_A || b == VALUE_B),
        "{ctx}: bad solution byte"
    );

    let d = parse_description(&g.description).unwrap();
    let cells = d.width as usize * d.height as usize;
    assert_eq!(g.solution.len(), cells, "{ctx}: solution length");
    for (i, &v) in d.givens.iter().enumerate() {
        assert!(v == EMPTY || v == g.solution[i], "{ctx}: given {i} disagrees with solution");
    }

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
        for &k in &hint.focus {
            assert!((k as usize) < cells, "{ctx}: focus key {k} is not a cell");
        }
        assert!(!hint.conclusions.is_empty(), "{ctx}: empty conclusions");
        for &(cell, value) in &hint.conclusions {
            assert!((cell as usize) < cells, "{ctx}: conclusion key {cell} is not a cell");
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
fn generated_8x8_easy() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(8, 8, Tier::Easy));
    }
}

#[test]
fn generated_8x8_tricky() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(8, 8, Tier::Tricky));
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
    for seed in 0..20 {
        let p = params(8, 8, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p);
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] = if grid[i] == VALUE_A { VALUE_B } else { VALUE_A };
            assert!(
                !check_rules(&g.description, &grid).is_empty(),
                "seed {seed}: flipping cell {i} went unnoticed"
            );
        }
    }
}

#[test]
fn generation_is_deterministic() {
    for (w, h, tier) in [(8, 8, Tier::Easy), (10, 10, Tier::Tricky)] {
        let a = generate(7, params(w, h, tier));
        let b = generate(7, params(w, h, tier));
        assert_eq!(a.description, b.description);
        assert_eq!(a.solution, b.solution);
        assert_eq!(a.hints, b.hints);
    }
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42. Any change here means the wire encoding
    // or the generator's RNG stream drifted.
    const EASY_DESCRIPTION_HEX: &str = "01080802000200010100000200000000000002000000000000000000020002000000010000010000000000000200000202000000000000000001000000020001000002";
    const EASY_SOLUTION_HEX: &str = "02010202010102010202010102010102010102010202010201020102010202010201010201010202010202010202010102020101020201010101020201010202";
    let g = generate(42, params(8, 8, Tier::Easy));
    assert_eq!(hex(&g.description), EASY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), EASY_SOLUTION_HEX);

    const TRICKY_DESCRIPTION_HEX: &str = "010a0a01000001000000000000000200000000000000000002000200000000000201000000010000000000000000000000020001000100000000000000000000000000000202000100000200000000000000020100000000000200020001000001000000020002";
    const TRICKY_SOLUTION_HEX: &str = "01010201020201020201020201010201020102010202010201010201010201010202010201020201020201010201020101020101020201020102020102010102010202010102020201010201010201020101020201020201020101020201020101020102";
    let g = generate(42, params(10, 10, Tier::Tricky));
    assert_eq!(hex(&g.description), TRICKY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), TRICKY_SOLUTION_HEX);
}

#[test]
fn parse_rejects_bad_input() {
    let good = generate(1, params(8, 8, Tier::Easy)).description;
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

    // Odd width or height is impossible: each line must split evenly.
    let mut odd = vec![1, 7, 8];
    odd.extend(std::iter::repeat_n(0, 56));
    assert!(parse_description(&odd).is_err(), "odd width accepted");
    let mut odd = vec![1, 8, 7];
    odd.extend(std::iter::repeat_n(0, 56));
    assert!(parse_description(&odd).is_err(), "odd height accepted");
    assert!(parse_description(&[1, 0, 0]).is_err(), "0x0 accepted");

    for bad in [0x03, 0x04, 0x80, 0xff] {
        let mut bytes = good.clone();
        bytes[3] = bad;
        assert!(parse_description(&bytes).is_err(), "given byte {bad:#04x} accepted");
    }

    let d = parse_description(&good).unwrap();
    assert_eq!(d.givens.len(), 64);
    assert!(d.givens.iter().any(|&v| v != EMPTY));
    assert!(d.givens.contains(&EMPTY));
}

#[test]
fn render_ascii_has_tathams_shape() {
    let g = generate(3, params(10, 8, Tier::Easy));
    let puzzle = render_ascii(&g.description, None);
    let solved = render_ascii(&g.description, Some(&g.solution));
    assert_eq!(puzzle.lines().count(), 8);
    assert_eq!(solved.lines().count(), 8);
    assert!(puzzle.lines().all(|l| l.chars().count() == 20));
    assert!(puzzle.contains('.'), "puzzle should have blanks");
    assert!(solved.contains('0') && solved.contains('1'));
    assert!(!solved.contains('.'), "solved grid should have no blanks");
    assert_eq!(
        render_ascii(&[1, 3, 4], None),
        "",
        "malformed description should render nothing"
    );
}

/// Description with no givens at all.
fn blank(w: u8, h: u8) -> Vec<u8> {
    let mut d = vec![1, w, h];
    d.extend(std::iter::repeat_n(0, w as usize * h as usize));
    d
}

#[test]
fn check_rules_reports_runs() {
    let d = blank(4, 4);
    let mut grid = vec![EMPTY; 16];
    assert!(check_rules(&d, &grid).is_empty(), "empty grid is incomplete, not wrong");

    // Three in a row across the top, which also overfills the row.
    grid[0] = VALUE_A;
    grid[1] = VALUE_A;
    grid[2] = VALUE_A;
    assert_eq!(
        check_rules(&d, &grid),
        vec![
            Violation::Run {
                cells: vec![0, 1, 2],
                value: VALUE_A
            },
            Violation::RowCount {
                row: 0,
                value: VALUE_A,
                count: 3
            }
        ]
    );

    // Three down the left, with the rest of the column blank.
    let mut grid = vec![EMPTY; 16];
    grid[0] = VALUE_B;
    grid[4] = VALUE_B;
    grid[8] = VALUE_B;
    assert_eq!(
        check_rules(&d, &grid),
        vec![
            Violation::Run {
                cells: vec![0, 4, 8],
                value: VALUE_B
            },
            Violation::ColumnCount {
                column: 0,
                value: VALUE_B,
                count: 3
            }
        ]
    );
}

#[test]
fn check_rules_reports_counts() {
    let d = blank(4, 4);
    let mut grid = vec![EMPTY; 16];
    // Three of a value in one row without three in a row.
    grid[0] = VALUE_A;
    grid[1] = VALUE_A;
    grid[2] = VALUE_B;
    grid[3] = VALUE_A;
    assert_eq!(
        check_rules(&d, &grid),
        vec![Violation::RowCount {
            row: 0,
            value: VALUE_A,
            count: 3
        }]
    );
    // Two of each is fine.
    grid[3] = VALUE_B;
    assert!(check_rules(&d, &grid).is_empty());
}

#[test]
fn partial_solution_is_incomplete_not_wrong() {
    let g = generate(9, params(8, 8, Tier::Tricky));
    let mut grid = g.solution.clone();
    for b in grid.iter_mut().step_by(2) {
        *b = EMPTY;
    }
    assert!(check_rules(&g.description, &grid).is_empty());
    assert!(check_rules(&g.description, &[]).is_empty(), "wrong length reads as empty");
}

#[test]
fn count_solutions_handles_bad_and_ambiguous_input() {
    assert_eq!(count_solutions(&[1, 7, 8], 2), 0, "malformed description");
    // A 6x6 grid with nothing given has many solutions.
    assert_eq!(count_solutions(&blank(6, 6), 2), 2);
}
