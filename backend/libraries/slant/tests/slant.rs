use slant::{
    BACKSLASH, Generated, Params, SLASH, Tier, Violation, check_rules, count_solutions, generate, parse_description,
    render_ascii, solution_pairs, solve_with_trace,
};
use std::collections::BTreeMap;

const SEEDS_PER_CONFIG: u64 = 200;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    Params::default_for(width, height, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn replay_hints(g: &Generated) -> Vec<u8> {
    let d = parse_description(&g.description).unwrap();
    let mut grid = vec![0u8; d.width as usize * d.height as usize];
    for hint in &g.hints {
        for &(cell, value) in &hint.conclusions {
            let cell = cell as usize;
            assert!(value == BACKSLASH || value == SLASH, "bad conclusion value {value}");
            assert_eq!(grid[cell], 0, "hint fixes cell {cell} twice");
            grid[cell] = value;
        }
    }
    grid
}

/// `pairs` is the solution over every cell, and every hint conclusion
/// agrees with it.
fn check_pairs(g: &Generated, ctx: &str) {
    assert_eq!(g.pairs, solution_pairs(&g.description, &g.solution), "{ctx}: pairs");
    let keys: Vec<u16> = g.pairs.iter().map(|&(k, _)| k).collect();
    let cells: Vec<u16> = (0..g.solution.len() as u16).collect();
    assert_eq!(keys, cells, "{ctx}: pairs keys are not every cell");
    let pairs: BTreeMap<u16, u8> = g.pairs.iter().copied().collect();
    let mut replayed = BTreeMap::new();
    for hint in &g.hints {
        for &(k, v) in &hint.conclusions {
            replayed.insert(k, v);
        }
    }
    assert_eq!(replayed, pairs, "{ctx}: replayed hints differ from pairs");
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
        g.solution.iter().all(|&b| b == BACKSLASH || b == SLASH),
        "{ctx}: bad solution byte"
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
fn generated_6x6_easy() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(6, 6, Tier::Easy));
    }
}

#[test]
fn generated_6x6_tricky() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(6, 6, Tier::Tricky));
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
fn single_cell_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(6, 6, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p);
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] = if grid[i] == BACKSLASH { SLASH } else { BACKSLASH };
            assert!(
                !check_rules(&g.description, &grid).is_empty(),
                "seed {seed}: flipping cell {i} went unnoticed"
            );
        }
    }
}

#[test]
fn generation_is_deterministic() {
    for (w, h, tier) in [(6, 6, Tier::Easy), (8, 8, Tier::Tricky)] {
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
    const EASY_DESCRIPTION_HEX: &str =
        "01060600ffffff010101ffffff030203ff0202ff02ffff01ffff0103ffffffff03ff0202ff00ff0102ff01ffffffffffffff01ff";
    const EASY_SOLUTION_HEX: &str = "020101020202020202020201010101010101010102010102020102010101010102010202";
    let g = generate(42, params(6, 6, Tier::Easy));
    assert_eq!(hex(&g.description), EASY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), EASY_SOLUTION_HEX);

    const TRICKY_DESCRIPTION_HEX: &str = "010808ffffffffffffffffffff0101ff0301ff01ffff030302ffff02ff010102ff0201ff0201ffff0201ffff02ffff01ff0103ffffff01ff01ff03ffff01ff0201ffff02030102ff0301ffff01ffffff01ffffff";
    const TRICKY_SOLUTION_HEX: &str = "02020102020102010102020201010101020201010102020102020101020101010101010202010101010201020101020102020201010102020202010101010102";
    let g = generate(42, params(8, 8, Tier::Tricky));
    assert_eq!(hex(&g.description), TRICKY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), TRICKY_SOLUTION_HEX);
}

#[test]
fn parse_rejects_bad_input() {
    let good = generate(1, params(6, 6, Tier::Easy)).description;
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
    assert!(parse_description(&[1, 1, 1, 0, 0, 0, 0]).is_err(), "1x1 accepted");

    for bad in [0x05, 0x10, 0x80, 0xfe] {
        let mut bytes = good.clone();
        bytes[3] = bad;
        assert!(parse_description(&bytes).is_err(), "clue byte {bad:#04x} accepted");
    }

    let d = parse_description(&good).unwrap();
    assert_eq!(d.clues.len(), 49);
    assert!(d.clues.iter().any(Option::is_some));
    assert!(d.clues.iter().any(Option::is_none));
}

#[test]
fn render_ascii_has_tathams_shape() {
    let g = generate(3, params(8, 6, Tier::Easy));
    let puzzle = render_ascii(&g.description, None);
    let solved = render_ascii(&g.description, Some(&g.solution));
    assert_eq!(puzzle.lines().count(), 13);
    assert_eq!(solved.lines().count(), 13);
    assert!(puzzle.lines().all(|l| l.chars().count() == 17));
    assert!(solved.contains('\\') && solved.contains('/'));
    assert!(!solved.contains("| |"), "solved grid should have no empty cells");
}

/// Description with no clues at all: only the loop rule can fire.
fn clueless(w: u8, h: u8) -> Vec<u8> {
    let mut d = vec![1, w, h];
    d.extend(std::iter::repeat_n(0xFF, (w as usize + 1) * (h as usize + 1)));
    d
}

#[test]
fn check_rules_reports_loops() {
    // A diamond around the centre vertex of a 3x3 grid, using cells
    // (1,1) '/', (2,1) '\', (1,2) '\', (2,2) '/'.
    let d = clueless(3, 3);
    let mut grid = vec![0u8; 9];
    grid[4] = SLASH;
    grid[5] = BACKSLASH;
    grid[7] = BACKSLASH;
    grid[8] = SLASH;
    let violations = check_rules(&d, &grid);
    assert_eq!(violations.len(), 1);
    let Violation::Loop { cells } = &violations[0] else {
        panic!("expected a loop, got {violations:?}");
    };
    let mut sorted = cells.clone();
    sorted.sort_unstable();
    assert_eq!(sorted, vec![4, 5, 7, 8]);

    // Break the diamond: no loop, and empty cells are not violations.
    grid[8] = BACKSLASH;
    assert!(check_rules(&d, &grid).is_empty());
    assert!(check_rules(&d, &[0u8; 9]).is_empty());
}

#[test]
fn check_rules_reports_vertex_counts() {
    // 2x2 grid, centre vertex (index 4 of the 3x3 vertex grid) clued 4.
    let mut d = clueless(2, 2);
    d[3 + 4] = 4;

    assert!(check_rules(&d, &[0u8; 4]).is_empty(), "empty grid is incomplete, not wrong");
    // Three cells pointing in is still achievable.
    assert!(check_rules(&d, &[BACKSLASH, SLASH, SLASH, 0]).is_empty());
    // One cell pointing away makes 4 impossible.
    assert_eq!(
        check_rules(&d, &[SLASH, 0, 0, 0]),
        vec![Violation::VertexCount {
            vertex: 4,
            expected: 4,
            lines: 0,
            possible: 3
        }]
    );

    // Clue 0 with a line touching it.
    d[3 + 4] = 0;
    assert_eq!(
        check_rules(&d, &[BACKSLASH, 0, 0, 0]),
        vec![Violation::VertexCount {
            vertex: 4,
            expected: 0,
            lines: 1,
            possible: 4
        }]
    );
}

#[test]
fn partial_solution_is_incomplete_not_wrong() {
    let g = generate(9, params(6, 6, Tier::Tricky));
    let mut grid = g.solution.clone();
    for b in grid.iter_mut().step_by(2) {
        *b = 0;
    }
    assert!(check_rules(&g.description, &grid).is_empty());
    assert!(check_rules(&g.description, &[]).is_empty(), "wrong length reads as empty");
}

#[test]
fn hint_focus_keys_are_in_range() {
    for seed in 0..20 {
        let g = generate(seed, params(8, 8, Tier::Tricky));
        let d = parse_description(&g.description).unwrap();
        let cells = d.width as usize * d.height as usize;
        let max = cells + d.clues.len();
        for hint in &g.hints {
            for &k in &hint.focus {
                assert!((k as usize) < max, "focus key {k} out of range");
            }
            for &(k, _) in &hint.conclusions {
                assert!((k as usize) < cells, "conclusion key {k} is not a cell");
            }
        }
    }
}
