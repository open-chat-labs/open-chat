use std::collections::BTreeMap;
use tents::{
    Cell, Generated, Params, Tier, Violation, check_rules, count_solutions, generate, parse_description, render_ascii,
    solution_pairs, solve_with_trace,
};

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
    let mut grass = vec![false; grid.len()];
    for hint in &g.hints {
        for &(cell, value) in &hint.conclusions {
            let cell = cell as usize;
            assert_eq!(d.cells[cell], Cell::Empty, "hint concludes about a tree cell");
            assert!(grid[cell] == 0 && !grass[cell], "hint fixes a cell that is already fixed");
            if value == 1 {
                grid[cell] = 1;
            } else {
                grass[cell] = true;
            }
        }
    }
    grid
}

/// `pairs` is the solution over exactly the non-tree cells, and every
/// hint conclusion agrees with it.
fn check_pairs(g: &Generated, ctx: &str) {
    let d = parse_description(&g.description).unwrap();
    assert_eq!(g.pairs, solution_pairs(&g.description, &g.solution), "{ctx}: pairs");
    let keys: Vec<u16> = g.pairs.iter().map(|&(k, _)| k).collect();
    let empty: Vec<u16> = (0..d.cells.len() as u16)
        .filter(|&i| d.cells[i as usize] == Cell::Empty)
        .collect();
    assert_eq!(keys, empty, "{ctx}: pairs keys are not the non-tree cells");
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
        assert!(
            hint.target.iter().all(|t| hint.focus.contains(t)),
            "{ctx}: target not a subset of focus"
        );
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
    for seed in 0..50 {
        let p = params(8, 8, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
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
    // Generated once from seed 42, 8x8, 20% trees, Easy. Any change here
    // means the wire encoding or the generator's RNG stream drifted.
    const DESCRIPTION_HEX: &str = "0108080000000001000000000100000000000000010000000000000000000000010001000000000100000100000000000100000100010000000100000000000000010002000201020102020102000200040003";
    const SOLUTION_HEX: &str = "00010000000100000000000000000000000000000001000100010000000000000000000100010000000000000000000100000001000100000100000000000001";
    let g = generate(42, params(8, 8, Tier::Easy));
    assert_eq!(hex(&g.description), DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), SOLUTION_HEX);
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
    assert!(parse_description(&[1, 0, 8]).is_err());

    for bad in [0x02, 0x10, 0xff] {
        let mut bytes = good.clone();
        bytes[3] = bad;
        assert!(parse_description(&bytes).is_err(), "cell byte {bad:#04x} accepted");
    }

    let mut big_row_count = good.clone();
    big_row_count[3 + 64] = 9;
    assert!(parse_description(&big_row_count).is_err());
    let mut big_column_count = good.clone();
    big_column_count[3 + 64 + 8] = 9;
    assert!(parse_description(&big_column_count).is_err());

    let d = parse_description(&good).unwrap();
    assert_eq!(d.cells.len(), 64);
    assert_eq!(d.cells.iter().filter(|&&c| c == Cell::Tree).count(), 12);
    assert_eq!(d.row_counts.len(), 8);
    assert_eq!(d.column_counts.len(), 8);
    assert_eq!(d.row_counts.iter().map(|&c| c as usize).sum::<usize>(), 12);
    assert_eq!(d.column_counts.iter().map(|&c| c as usize).sum::<usize>(), 12);
}

#[test]
fn render_ascii_has_one_line_per_row_plus_column_counts() {
    let g = generate(3, params(10, 7, Tier::Easy));
    let puzzle = render_ascii(&g.description, None);
    let solved = render_ascii(&g.description, Some(&g.solution));
    assert_eq!(puzzle.lines().count(), 8);
    assert_eq!(solved.lines().count(), 8);
    assert!(puzzle.lines().take(7).all(|l| l.len() == 12));
    assert_eq!(puzzle.lines().last().unwrap().len(), 10);
    assert!(puzzle.contains('T'));
    assert!(!puzzle.contains('A'));
    assert_eq!(solved.matches('A').count(), 14);
}

#[test]
fn check_rules_reports_each_violation_kind() {
    let g = generate(5, params(8, 8, Tier::Easy));
    let d = parse_description(&g.description).unwrap();
    let w = d.width as usize;

    let tree = d.cells.iter().position(|&c| c == Cell::Tree).unwrap();
    let mut on_tree = g.solution.clone();
    on_tree[tree] = 1;
    assert!(check_rules(&g.description, &on_tree).contains(&Violation::TentOnTree { cell: tree as u16 }));

    let empty = vec![0u8; g.solution.len()];
    let violations = check_rules(&g.description, &empty);
    assert!(violations.iter().any(|v| matches!(v, Violation::RowCount { actual: 0, .. })));
    assert!(
        violations
            .iter()
            .any(|v| matches!(v, Violation::ColumnCount { actual: 0, .. }))
    );
    assert!(
        violations
            .iter()
            .any(|v| matches!(v, Violation::Unmatched { tents, .. } if tents.is_empty()))
    );
    assert!(
        !violations
            .iter()
            .any(|v| matches!(v, Violation::TentsTouch { .. } | Violation::TentOnTree { .. }))
    );

    // A tent placed diagonally below-right of an existing tent touches it.
    let tent = g.solution.iter().position(|&b| b == 1).unwrap();
    let diag = tent + w + 1;
    if tent % w + 1 < w && diag < g.solution.len() && d.cells[diag] == Cell::Empty {
        let mut touching = g.solution.clone();
        touching[diag] = 1;
        assert!(check_rules(&g.description, &touching).contains(&Violation::TentsTouch {
            a: tent as u16,
            b: diag as u16
        }));
    }

    // A tent with no tree beside it.
    let lonely = (0..g.solution.len())
        .find(|&i| {
            d.cells[i] == Cell::Empty
                && [
                    (i % w > 0).then(|| i - 1),
                    (i % w + 1 < w).then(|| i + 1),
                    (i >= w).then(|| i - w),
                    (i + w < g.solution.len()).then(|| i + w),
                ]
                .into_iter()
                .flatten()
                .all(|j| d.cells[j] == Cell::Empty)
        })
        .unwrap();
    let mut alone = empty.clone();
    alone[lonely] = 1;
    assert!(check_rules(&g.description, &alone).contains(&Violation::TentWithoutTree { cell: lonely as u16 }));
}

#[test]
fn tricky_uses_a_tricky_technique() {
    let g = generate(0, params(10, 10, Tier::Tricky));
    assert!(
        g.hints
            .iter()
            .any(|h| matches!(h.technique, tents::Technique::TreeCorner | tents::Technique::LineNeighbour))
    );
}
