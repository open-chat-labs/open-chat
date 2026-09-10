use bridges::{
    Description, Generated, Params, Tier, Violation, check_rules, count_solutions, generate, parse_description, render_ascii,
    solution_pairs, solve_with_trace,
};
use std::collections::BTreeMap;

const SEEDS_PER_CONFIG: u64 = 100;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    Params::default_for(width, height, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Paints an edge's water cells with the canonical byte for its
/// orientation and count. A 0 paints nothing: the cell may carry the
/// crossing bridge.
fn paint_edge(d: &Description, grid: &mut [u8], key: u16, value: u8) {
    let w = d.width as usize;
    assert!(value <= 2, "bad bridge count {value}");
    let from = key as usize / 2;
    let (dx, dy) = if key.is_multiple_of(2) { (1, 0) } else { (0, 1) };
    let (mut x, mut y) = (from % w + dx, from / w + dy);
    let mut cells = 0;
    while d.cells[y * w + x] == 0 {
        if value > 0 {
            grid[y * w + x] = if dx == 1 { value } else { 2 + value };
        }
        cells += 1;
        x += dx;
        y += dy;
    }
    assert!(cells > 0, "edge {key} joins adjacent islands");
}

/// Applies every conclusion to an empty grid.
fn replay_hints(g: &Generated) -> Vec<u8> {
    let d = parse_description(&g.description).unwrap();
    let mut grid = vec![0u8; d.width as usize * d.height as usize];
    let mut seen = std::collections::HashSet::new();
    for hint in &g.hints {
        for &(key, value) in &hint.conclusions {
            assert!(seen.insert(key), "edge {key} concluded twice");
            paint_edge(&d, &mut grid, key, value);
        }
    }
    grid
}

/// `pairs` covers every derivable edge in hint-key space, agrees with the
/// hint conclusions, and paints back to the solution bytes.
fn check_pairs(g: &Generated, ctx: &str) {
    let d = parse_description(&g.description).unwrap();
    assert_eq!(g.pairs, solution_pairs(&g.description, &g.solution), "{ctx}: pairs");
    assert!(g.pairs.windows(2).all(|p| p[0].0 < p[1].0), "{ctx}: pairs not sorted by key");
    let w = d.width as usize;
    // Every island's right / down neighbour across clear water, in key order.
    let mut edges = Vec::new();
    for (i, &c) in d.cells.iter().enumerate() {
        if c == 0 {
            continue;
        }
        let (x, y) = (i % w, i / w);
        if (x + 1..w).map(|cx| d.cells[y * w + cx]).find(|&b| b != 0).is_some() {
            edges.push((i * 2) as u16);
        }
        if (y + 1..d.height as usize)
            .map(|cy| d.cells[cy * w + x])
            .find(|&b| b != 0)
            .is_some()
        {
            edges.push((i * 2 + 1) as u16);
        }
    }
    let keys: Vec<u16> = g.pairs.iter().map(|&(k, _)| k).collect();
    assert_eq!(keys, edges, "{ctx}: pairs keys are not every derivable edge");
    let pairs: BTreeMap<u16, u8> = g.pairs.iter().copied().collect();
    let mut replayed = BTreeMap::new();
    for hint in &g.hints {
        for &(k, v) in &hint.conclusions {
            replayed.insert(k, v);
        }
    }
    assert_eq!(replayed, pairs, "{ctx}: replayed hints differ from pairs");
    let mut grid = vec![0u8; d.cells.len()];
    for &(key, value) in &g.pairs {
        paint_edge(&d, &mut grid, key, value);
    }
    assert_eq!(grid, g.solution, "{ctx}: pairs do not paint back to the solution");
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

    let replayed = replay_hints(&g);
    for hint in &g.hints {
        assert!(!hint.focus.is_empty(), "{ctx}: empty focus");
        assert!(!hint.target.is_empty(), "{ctx}: empty target");
        assert!(
            hint.target.iter().all(|k| hint.focus.contains(k)),
            "{ctx}: target {:?} is not a subset of focus {:?}",
            hint.target,
            hint.focus
        );
        assert!(!hint.conclusions.is_empty(), "{ctx}: empty conclusions");
        for &(key, value) in &hint.conclusions {
            let from = key as usize / 2;
            let first = if key % 2 == 0 { from + 1 } else { from + p.width as usize };
            let expected = match (key % 2, g.solution[first]) {
                (0, b @ (1 | 2)) => b,
                (1, b @ (3 | 4)) => b - 2,
                _ => 0,
            };
            assert_eq!(value, expected, "{ctx}: conclusion for edge {key} disagrees with solution");
        }
    }
    assert_eq!(replayed, g.solution, "{ctx}: replaying hints does not reach the solution");
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
fn generated_9x9_easy() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(9, 9, Tier::Easy));
    }
}

#[test]
fn generated_9x9_tricky() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(9, 9, Tier::Tricky));
    }
}

#[test]
fn single_cell_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(7, 7, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p);
        for i in 0..g.solution.len() {
            for b in 0..=5u8 {
                if b == g.solution[i] {
                    continue;
                }
                let mut grid = g.solution.clone();
                grid[i] = b;
                assert!(
                    !check_rules(&g.description, &grid).is_empty(),
                    "seed {seed}: setting cell {i} to {b} went unnoticed"
                );
            }
        }
    }
}

#[test]
fn generation_is_deterministic() {
    for (w, h, tier) in [(7, 7, Tier::Easy), (9, 9, Tier::Tricky)] {
        let a = generate(7, params(w, h, tier));
        let b = generate(7, params(w, h, tier));
        assert_eq!(a.description, b.description);
        assert_eq!(a.solution, b.solution);
        assert_eq!(a.hints, b.hints);
    }
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42, 7x7, 30% islands, 10% expansion, Easy.
    // Any change here means the wire encoding or the generator's RNG
    // stream drifted.
    const DESCRIPTION_HEX: &str =
        "01070704000500000003000000000000000000040000020005000000000005000003000001000000000001000304000600000200";
    const SOLUTION_HEX: &str =
        "00020001010100040004000000040400000202000400010101010100040000010100040400040000010000020002020000";
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

    let mut bytes = good.clone();
    bytes[3] = 9;
    assert!(parse_description(&bytes).is_err(), "island count 9 accepted");

    let d = parse_description(&good).unwrap();
    let island = d.cells.iter().position(|&c| c > 0).unwrap();
    let mut touching = good.clone();
    touching[3 + island + 1] = 1;
    assert!(parse_description(&touching).is_err(), "adjacent islands accepted");

    let mut lonely = vec![1, 3, 3];
    lonely.extend([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    assert!(parse_description(&lonely).is_err(), "single island accepted");
    assert_eq!(d.cells.len(), 49);
}

#[test]
fn render_ascii_has_one_line_per_row() {
    let g = generate(3, params(9, 7, Tier::Easy));
    let puzzle = render_ascii(&g.description, None);
    let solved = render_ascii(&g.description, Some(&g.solution));
    assert_eq!(puzzle.lines().count(), 7);
    assert_eq!(solved.lines().count(), 7);
    assert!(puzzle.lines().all(|l| l.len() == 9));
    assert!(puzzle.chars().any(|c| c.is_ascii_digit()));
    assert!(solved.chars().any(|c| matches!(c, '-' | '=' | '|' | '"')));
}

#[test]
fn check_rules_reports_each_violation_kind() {
    let g = generate(5, params(7, 7, Tier::Easy));
    let d = parse_description(&g.description).unwrap();
    let island = d.cells.iter().position(|&c| c > 0).unwrap();

    let mut grid = g.solution.clone();
    grid[island] = 1;
    assert!(check_rules(&g.description, &grid).contains(&Violation::BadByte { cell: island as u16 }));

    let empty = vec![0u8; grid.len()];
    let violations = check_rules(&g.description, &empty);
    assert!(
        violations
            .iter()
            .all(|v| matches!(v, Violation::IslandCount { actual: 0, .. }))
    );
    assert_eq!(violations.len(), d.cells.iter().filter(|&&c| c > 0).count());

    // A bridge on a cell that lies between two islands vertically but not
    // horizontally is a stray if painted horizontal.
    let w = d.width as usize;
    let vertical = g.solution.iter().position(|&b| b == 3 || b == 4).unwrap();
    let on_horizontal_edge = {
        let (x, y) = (vertical % w, vertical / w);
        let left = (0..x).rev().map(|cx| y * w + cx).find(|&c| d.cells[c] > 0);
        let right = (x + 1..w).map(|cx| y * w + cx).find(|&c| d.cells[c] > 0);
        left.is_some() && right.is_some()
    };
    if !on_horizontal_edge {
        let mut stray = g.solution.clone();
        stray[vertical] = 1;
        assert!(check_rules(&g.description, &stray).contains(&Violation::Stray { cell: vertical as u16 }));
    }
}

#[test]
fn check_rules_reports_disconnection_and_crossing() {
    // 5x3, the four corners are islands; the two rows are joined but not
    // to each other.
    let mut desc = vec![1, 5, 3];
    desc.extend([1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    let grid = [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0];
    assert_eq!(
        check_rules(&desc, &grid),
        vec![Violation::Disconnected { islands: vec![10, 14] }]
    );
    let half = [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    assert!(
        check_rules(&desc, &half)
            .iter()
            .all(|v| matches!(v, Violation::IslandCount { .. })),
        "an incomplete grid is not a disconnection"
    );

    // 3x5: a vertical bridge down the middle column crossed by a
    // horizontal one through the centre cell.
    let mut desc = vec![1, 3, 5];
    desc.extend([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0]);
    let grid = [0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0];
    let violations = check_rules(&desc, &grid);
    assert!(
        violations.contains(&Violation::Crossing {
            horizontal: 12,
            vertical: 3
        }),
        "{violations:?}"
    );
    assert!(!violations.iter().any(|v| matches!(v, Violation::IslandCount { .. })));

    // The same vertical bridge with a gap in it.
    let grid = [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0];
    assert!(check_rules(&desc, &grid).contains(&Violation::Inconsistent { key: 3 }));
}
