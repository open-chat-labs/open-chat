use bridges::{
    Bridges, Description, Params, Violation, check_rules, count_solutions, generate, is_complete, parse_description,
    render_ascii, solution_pairs, solve_with_trace,
};
use puzzle_core::testing::{
    must_generate, must_only_claim_sound_solutions, must_reject, must_terminate, must_work_through_dyn,
};
use puzzle_core::{Puzzle, PuzzleError, Tier};

const SEEDS_PER_CONFIG: u64 = 100;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    Params::default_for(width, height, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// The sizes The Daily can serve, both tiers of each.
fn playable() -> Vec<Params> {
    let mut out = Vec::new();
    for (w, h) in [(7, 7), (7, 9), (9, 7), (9, 9), (11, 11)] {
        for tier in Tier::ALL {
            out.push(params(w, h, tier));
        }
    }
    out
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

/// Bridges keys its hints by edge rather than by cell, so the shared
/// harness cannot check that `pairs` covers the right keys or that they
/// paint back to the solution bytes. Both are checked here.
#[test]
fn pairs_cover_every_derivable_edge_and_paint_the_solution() {
    for seed in 0..20 {
        for tier in Tier::ALL {
            let g = generate(seed, params(7, 7, tier)).unwrap();
            let ctx = format!("seed {seed} {tier:?}");
            let d = parse_description(&g.description).unwrap();
            assert!(g.pairs.windows(2).all(|p| p[0].0 < p[1].0), "{ctx}: pairs not sorted by key");

            // Every island's right / down neighbour across clear water, in key order.
            let w = d.width as usize;
            let mut edges = Vec::new();
            for (i, &c) in d.cells.iter().enumerate() {
                if c == 0 {
                    continue;
                }
                let (x, y) = (i % w, i / w);
                if (x + 1..w).map(|cx| d.cells[y * w + cx]).any(|b| b != 0) {
                    edges.push((i * 2) as u16);
                }
                if (y + 1..d.height as usize).map(|cy| d.cells[cy * w + x]).any(|b| b != 0) {
                    edges.push((i * 2 + 1) as u16);
                }
            }
            let keys: Vec<u16> = g.pairs.iter().map(|&(k, _)| k).collect();
            assert_eq!(keys, edges, "{ctx}: pairs keys are not every derivable edge");

            let mut grid = vec![0u8; d.cells.len()];
            for &(key, value) in &g.pairs {
                paint_edge(&d, &mut grid, key, value);
            }
            assert_eq!(grid, g.solution, "{ctx}: pairs do not paint back to the solution");
        }
    }
}

#[test]
fn generated_7x7() {
    for tier in Tier::ALL {
        must_generate::<Bridges>(params(7, 7, tier), 0..SEEDS_PER_CONFIG);
    }
}

#[test]
fn generated_9x9() {
    for tier in Tier::ALL {
        must_generate::<Bridges>(params(9, 9, tier), 0..SEEDS_PER_CONFIG);
    }
}

/// Every size and tier this game accepts produces a puzzle. The point is
/// the parameter coverage: generation used to end in a panic, which in a
/// canister is a trap, for sizes that simply have no puzzle.
#[test]
fn every_playable_size_generates() {
    for p in playable() {
        must_generate::<Bridges>(p, 0..25);
    }
}

#[test]
fn impossible_params_are_rejected() {
    for (w, h) in [(0, 0), (1, 1), (2, 2), (2, 9), (9, 2)] {
        for tier in Tier::ALL {
            must_reject::<Bridges>(params(w, h, tier), 0..3);
        }
    }
    for island_pct in [0, 31, 100, 255] {
        let mut p = params(9, 9, Tier::Easy);
        p.island_pct = island_pct;
        must_reject::<Bridges>(p, 0..3);
    }
    let mut p = params(9, 9, Tier::Easy);
    p.expansion_pct = 101;
    must_reject::<Bridges>(p, 0..3);
}

/// A small grid has no Tricky puzzle at any seed. That used to be a
/// panic, which in a canister is a trap; it is now a `GenerateError` the
/// caller can act on by moving to another seed or another size.
#[test]
fn sizes_with_no_puzzle_return_an_error_rather_than_panicking() {
    for (w, h) in [(3, 3), (4, 4)] {
        for tier in Tier::ALL {
            must_terminate::<Bridges>(params(w, h, tier), 0..15);
        }
    }
    let mut p = params(4, 4, Tier::Tricky);
    p.island_pct = 30;
    p.expansion_pct = 50;
    assert!(generate(1, p).is_err(), "4x4 tricky should report failure, not panic");
}

/// Every density and expansion setting still has to return.
#[test]
fn every_density_terminates() {
    for island_pct in [1, 5, 10, 20, 30] {
        for expansion_pct in [0, 10, 50, 100] {
            for tier in Tier::ALL {
                let mut p = params(9, 9, tier);
                p.island_pct = island_pct;
                p.expansion_pct = expansion_pct;
                must_terminate::<Bridges>(p, 0..2);
            }
        }
    }
}

#[test]
fn single_cell_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(7, 7, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p).unwrap();
        for i in 0..g.solution.len() {
            for b in 0..=4u8 {
                if b == g.solution[i] {
                    continue;
                }
                let mut grid = g.solution.clone();
                grid[i] = b;
                assert!(
                    !Bridges::is_solved(&g.description, &grid).unwrap(),
                    "seed {seed}: setting cell {i} to {b} still counts as solved"
                );
            }
        }
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
    let g = generate(42, params(7, 7, Tier::Easy)).unwrap();
    assert_eq!(hex(&g.description), DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), SOLUTION_HEX);
}

#[test]
fn parse_rejects_bad_input() {
    let good = generate(1, params(7, 7, Tier::Easy)).unwrap().description;
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
    let g = generate(3, params(9, 7, Tier::Easy)).unwrap();
    let puzzle = render_ascii(&g.description, None).unwrap();
    let solved = render_ascii(&g.description, Some(&g.solution)).unwrap();
    assert_eq!(puzzle.lines().count(), 7);
    assert_eq!(solved.lines().count(), 7);
    assert!(puzzle.lines().all(|l| l.len() == 9));
    assert!(puzzle.chars().any(|c| c.is_ascii_digit()));
    assert!(solved.chars().any(|c| matches!(c, '-' | '=' | '|' | '"')));
}

#[test]
fn check_rules_reports_each_violation_kind() {
    let g = generate(5, params(7, 7, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let island = d.cells.iter().position(|&c| c > 0).unwrap();

    let mut grid = g.solution.clone();
    grid[island] = 1;
    assert!(
        check_rules(&g.description, &grid)
            .unwrap()
            .contains(&Violation::BridgeOnIsland { cell: island as u16 })
    );

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
        assert!(
            check_rules(&g.description, &stray)
                .unwrap()
                .contains(&Violation::Stray { cell: vertical as u16 })
        );
    }
}

/// An island short of its bridges means the grid is unfinished, not
/// broken. This used to report every island on an untouched board, so a
/// client asking "am I going wrong?" was told yes before the first move.
#[test]
fn an_untouched_board_is_incomplete_not_wrong() {
    let g = generate(5, params(7, 7, Tier::Easy)).unwrap();
    let empty = vec![0u8; g.solution.len()];
    assert!(check_rules(&g.description, &empty).unwrap().is_empty());
    assert!(!is_complete(&g.description, &empty).unwrap());
    assert!(!Bridges::is_solved(&g.description, &empty).unwrap());
}

#[test]
fn check_rules_reports_disconnection_and_crossing() {
    // 5x3, the four corners are islands; the two rows are joined but not
    // to each other.
    let mut desc = vec![1, 5, 3];
    desc.extend([1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    let grid = [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0];
    assert_eq!(
        check_rules(&desc, &grid).unwrap(),
        vec![Violation::Disconnected { islands: vec![10, 14] }]
    );
    assert!(!is_complete(&desc, &grid).unwrap());

    let half = [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    assert!(
        check_rules(&desc, &half).unwrap().is_empty(),
        "an incomplete grid is not a disconnection"
    );
    assert!(!is_complete(&desc, &half).unwrap());

    // 3x5: a vertical bridge down the middle column crossed by a
    // horizontal one through the centre cell.
    let mut desc = vec![1, 3, 5];
    desc.extend([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0]);
    let grid = [0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0];
    let violations = check_rules(&desc, &grid).unwrap();
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
    assert!(
        check_rules(&desc, &grid)
            .unwrap()
            .contains(&Violation::Inconsistent { key: 3 })
    );
}

/// An island with more bridges than its number can never come right.
#[test]
fn an_island_over_its_number_is_a_violation() {
    // 5x3 with a 1 at each corner: joining the top pair with two bridges
    // puts both over their number.
    let mut desc = vec![1, 5, 3];
    desc.extend([1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    let grid = [0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let violations = check_rules(&desc, &grid).unwrap();
    assert!(
        violations.contains(&Violation::IslandCount {
            cell: 0,
            expected: 1,
            actual: 2
        }),
        "{violations:?}"
    );
}

/// A wrong-length grid is a caller bug. It used to read as an empty
/// board, which made a broken client look like an untouched puzzle.
#[test]
fn wrong_length_grids_are_rejected() {
    let g = generate(9, params(7, 7, Tier::Easy)).unwrap();
    let expected = g.solution.len();
    for grid in [vec![], vec![0u8; expected - 1], vec![0u8; expected + 1]] {
        let actual = grid.len();
        assert_eq!(
            check_rules(&g.description, &grid),
            Err(PuzzleError::GridLength { expected, actual })
        );
        assert_eq!(
            is_complete(&g.description, &grid),
            Err(PuzzleError::GridLength { expected, actual })
        );
    }
}

/// A byte outside the bridge encoding is reported, not read as water.
#[test]
fn unknown_grid_bytes_are_rejected() {
    let g = generate(9, params(7, 7, Tier::Easy)).unwrap();
    for byte in [5u8, 0x80, 0xff] {
        let mut grid = g.solution.clone();
        grid[0] = byte;
        assert_eq!(
            check_rules(&g.description, &grid),
            Err(PuzzleError::GridValue { cell: 0, byte })
        );
    }
}

/// Every entry point that takes a description reports a malformed one the
/// same way, instead of one panicking and the next returning a default.
#[test]
fn malformed_descriptions_are_reported_not_guessed() {
    let bad: &[u8] = &[1, 7, 7];
    assert!(matches!(check_rules(bad, &[]), Err(PuzzleError::Description(_))));
    assert!(matches!(is_complete(bad, &[]), Err(PuzzleError::Description(_))));
    assert!(matches!(count_solutions(bad, 2), Err(PuzzleError::Description(_))));
    assert!(matches!(solve_with_trace(bad, Tier::Easy), Err(PuzzleError::Description(_))));
    assert!(matches!(render_ascii(bad, None), Err(PuzzleError::Description(_))));
    assert!(matches!(solution_pairs(bad, &[]), Err(PuzzleError::Description(_))));
}

/// The game can be held as `&dyn PuzzleCheck`, so part 2's rota can be a
/// table of games rather than a match arm per game.
#[test]
fn works_through_a_dyn_reference() {
    let g = generate(1, params(7, 7, Tier::Easy)).unwrap();
    must_work_through_dyn::<Bridges>(&g.description, &g.solution);
    let blank = vec![0u8; g.solution.len()];
    must_work_through_dyn::<Bridges>(&g.description, &blank);
}

/// Island numbers drawn at random rather than from a bridge layout, on
/// boards small enough that the solver can often finish. Nothing
/// guarantees the numbers can be satisfied, let alone connected.
fn unsatisfiable_descriptions() -> Vec<Vec<u8>> {
    let mut rng = puzzle_core::Rng::new(20260911);
    let mut out = Vec::new();
    for (w, h) in [(3usize, 3usize), (4, 4), (5, 5)] {
        let n = w * h;
        for _ in 0..4_000 {
            let mut cells = vec![0u8; n];
            let mut islands = 0;
            for i in 0..n {
                let (x, y) = (i % w, i / w);
                let touches = (x > 0 && cells[i - 1] != 0) || (y > 0 && cells[i - w] != 0);
                if touches || rng.below(3) != 0 {
                    continue;
                }
                cells[i] = 1 + rng.below(4) as u8;
                islands += 1;
            }
            if islands < 2 {
                continue;
            }
            let mut d = vec![1, w as u8, h as u8];
            d.extend(cells);
            out.push(d);
        }
    }
    out
}

#[test]
fn the_solver_never_claims_an_unsound_grid() {
    let claimed = must_only_claim_sound_solutions::<Bridges>(unsatisfiable_descriptions());
    assert!(claimed > 100, "only {claimed} of the corpus reached the solver");
}
