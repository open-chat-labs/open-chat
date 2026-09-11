use puzzle_core::testing::{
    must_generate, must_only_claim_sound_solutions, must_reject, must_terminate, must_work_through_dyn,
};
use puzzle_core::{Puzzle, PuzzleError, Tier};
use tents::{
    Cell, Params, Tents, Violation, check_rules, count_solutions, generate, is_complete, parse_description, render_ascii,
    solution_pairs, solve_with_trace,
};

const SEEDS_PER_CONFIG: u64 = 200;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    Params::default_for(width, height, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// The sizes The Daily can serve, both tiers of each.
fn playable() -> Vec<Params> {
    let mut out = Vec::new();
    for (w, h) in [(5, 5), (6, 6), (8, 8), (8, 10), (10, 8), (10, 10), (12, 12), (14, 14)] {
        for tier in Tier::ALL {
            out.push(params(w, h, tier));
        }
    }
    out
}

#[test]
fn generated_8x8() {
    for tier in Tier::ALL {
        must_generate::<Tents>(params(8, 8, tier), 0..SEEDS_PER_CONFIG);
    }
}

#[test]
fn generated_10x10() {
    for tier in Tier::ALL {
        must_generate::<Tents>(params(10, 10, tier), 0..SEEDS_PER_CONFIG);
    }
}

/// Every size and tier this game accepts produces a puzzle. The point is
/// the parameter coverage: a combination that could never generate used
/// to spin forever instead of failing a test.
#[test]
fn every_playable_size_generates() {
    for p in playable() {
        must_generate::<Tents>(p, 0..25);
    }
}

/// Every tree density that leaves enough tents to reach every row and
/// column.
#[test]
fn every_workable_density_generates() {
    for tree_pct in [13, 15, 18, 20] {
        for tier in Tier::ALL {
            let mut p = params(10, 10, tier);
            p.tree_pct = tree_pct;
            must_generate::<Tents>(p, 0..25);
        }
    }
}

/// The top of the density range is legal but thin. At 25% on a grid of
/// 10x10 or more, most seeds have no layout that leaves a solvable
/// puzzle, so generation ends in `Exhausted` and the caller moves to the
/// next seed. It used to spin instead.
#[test]
fn the_densest_legal_setting_terminates() {
    for (w, h) in [(10, 10), (12, 12), (16, 16)] {
        for tier in Tier::ALL {
            let mut p = params(w, h, tier);
            p.tree_pct = 25;
            must_terminate::<Tents>(p, 0..3);
        }
    }
}

/// A density that rounds down to fewer trees than the grid has rows used
/// to spin forever: no layout can fill every row and column, so every
/// attempt was rejected and retried. It is now turned away up front.
#[test]
fn impossible_densities_are_rejected() {
    for (w, h, tree_pct) in [
        (8, 8, 1),
        (8, 8, 5),
        (8, 8, 12),
        (4, 4, 1),
        (4, 4, 24),
        (10, 10, 9),
        (8, 8, 0),
        (8, 8, 26),
        (8, 8, 100),
    ] {
        for tier in Tier::ALL {
            let mut p = params(w, h, tier);
            p.tree_pct = tree_pct;
            must_reject::<Tents>(p, 0..3);
        }
    }
}

#[test]
fn impossible_sizes_are_rejected() {
    for (w, h) in [(0, 0), (3, 3), (3, 8), (8, 3)] {
        for tier in Tier::ALL {
            must_reject::<Tents>(params(w, h, tier), 0..3);
        }
    }
}

/// Grids at the edge of what is playable still have to return.
#[test]
fn extreme_sizes_terminate() {
    for (w, h) in [(4, 4), (4, 20), (20, 4), (16, 16)] {
        for tier in Tier::ALL {
            for tree_pct in [20, 25] {
                let mut p = params(w, h, tier);
                p.tree_pct = tree_pct;
                must_terminate::<Tents>(p, 0..3);
            }
        }
    }
}

/// Tatham downgrades Tricky to Easy on a grid no bigger than 4x4, and the
/// puzzle reports the tier it actually used. A 4x4 needs the top density
/// to give each of its four rows a tree.
#[test]
fn tiny_grids_report_the_tier_they_used() {
    let mut p = params(4, 4, Tier::Tricky);
    p.tree_pct = 25;
    let g = generate(1, p).unwrap();
    assert_eq!(g.tier, Tier::Easy);
}

#[test]
fn single_cell_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(8, 8, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p).unwrap();
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] ^= 1;
            assert!(
                !Tents::is_solved(&g.description, &grid).unwrap(),
                "seed {seed}: flipping cell {i} still counts as solved"
            );
        }
    }
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42, 8x8, 20% trees, Easy. Any change here
    // means the wire encoding or the generator's RNG stream drifted.
    const DESCRIPTION_HEX: &str = "0108080000000001000000000100000000000000010000000000000000000000010001000000000100000100000000000100000100010000000100000000000000010002000201020102020102000200040003";
    const SOLUTION_HEX: &str = "00010000000100000000000000000000000000000001000100010000000000000000000100010000000000000000000100000001000100000100000000000001";
    let g = generate(42, params(8, 8, Tier::Easy)).unwrap();
    assert_eq!(hex(&g.description), DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), SOLUTION_HEX);
}

#[test]
fn parse_rejects_bad_input() {
    let good = generate(1, params(8, 8, Tier::Easy)).unwrap().description;
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
    let g = generate(3, params(10, 7, Tier::Easy)).unwrap();
    let puzzle = render_ascii(&g.description, None).unwrap();
    let solved = render_ascii(&g.description, Some(&g.solution)).unwrap();
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
    let g = generate(5, params(8, 8, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let w = d.width as usize;

    let tree = d.cells.iter().position(|&c| c == Cell::Tree).unwrap();
    let mut on_tree = g.solution.clone();
    on_tree[tree] = 1;
    assert!(
        check_rules(&g.description, &on_tree)
            .unwrap()
            .contains(&Violation::TentOnTree { cell: tree as u16 })
    );

    // A tent placed diagonally below-right of an existing tent touches it.
    let tent = g.solution.iter().position(|&b| b == 1).unwrap();
    let diag = tent + w + 1;
    if tent % w + 1 < w && diag < g.solution.len() && d.cells[diag] == Cell::Empty {
        let mut touching = g.solution.clone();
        touching[diag] = 1;
        assert!(
            check_rules(&g.description, &touching)
                .unwrap()
                .contains(&Violation::TentsTouch {
                    a: tent as u16,
                    b: diag as u16
                })
        );
    }

    // A tent with no tree beside it.
    let empty = vec![0u8; g.solution.len()];
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
    assert!(
        check_rules(&g.description, &alone)
            .unwrap()
            .contains(&Violation::TentWithoutTree { cell: lonely as u16 })
    );
}

/// A row short of its tents means the grid is unfinished, not broken.
/// This used to report every row, every column and every tree group on an
/// untouched board, so a client asking "am I going wrong?" was told yes
/// before the first move.
#[test]
fn an_untouched_board_is_incomplete_not_wrong() {
    let g = generate(5, params(8, 8, Tier::Easy)).unwrap();
    let empty = vec![0u8; g.solution.len()];
    assert!(check_rules(&g.description, &empty).unwrap().is_empty());
    assert!(!is_complete(&g.description, &empty).unwrap());
    assert!(!Tents::is_solved(&g.description, &empty).unwrap());
}

/// A row with more tents than its count can never come right, however the
/// rest of the grid is filled.
#[test]
fn a_row_over_its_count_is_a_violation() {
    let g = generate(5, params(8, 8, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let w = d.width as usize;
    let row = (0..d.height as usize)
        .find(|&y| d.row_counts[y] == 0 && (0..w).any(|x| d.cells[y * w + x] == Cell::Empty))
        .or_else(|| (0..d.height as usize).find(|&y| d.row_counts[y] < 2))
        .expect("a row with room to overfill");
    let mut grid = vec![0u8; g.solution.len()];
    let cells: Vec<usize> = (0..w)
        .map(|x| row * w + x)
        .filter(|&i| d.cells[i] == Cell::Empty)
        .step_by(2)
        .take(d.row_counts[row] as usize + 1)
        .collect();
    for &i in &cells {
        grid[i] = 1;
    }
    let actual = cells.len() as u8;
    assert!(check_rules(&g.description, &grid).unwrap().contains(&Violation::RowCount {
        row: row as u8,
        expected: d.row_counts[row],
        actual
    }));
}

/// A wrong-length grid is a caller bug. It used to read as a board with
/// no tents, which made a broken client look like an untouched puzzle.
#[test]
fn wrong_length_grids_are_rejected() {
    let g = generate(9, params(8, 8, Tier::Easy)).unwrap();
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

/// A byte this game gives no meaning to is reported, not read as no tent.
#[test]
fn unknown_grid_bytes_are_rejected() {
    let g = generate(9, params(8, 8, Tier::Easy)).unwrap();
    for byte in [2u8, 0x80, 0xff] {
        let mut grid = g.solution.clone();
        grid[5] = byte;
        assert_eq!(
            check_rules(&g.description, &grid),
            Err(PuzzleError::GridValue { cell: 5, byte })
        );
    }
}

/// Every entry point that takes a description reports a malformed one the
/// same way, instead of one panicking and the next returning a default.
#[test]
fn malformed_descriptions_are_reported_not_guessed() {
    let bad: &[u8] = &[1, 8, 8];
    assert!(matches!(check_rules(bad, &[]), Err(PuzzleError::Description(_))));
    assert!(matches!(is_complete(bad, &[]), Err(PuzzleError::Description(_))));
    assert!(matches!(count_solutions(bad, 2), Err(PuzzleError::Description(_))));
    assert!(matches!(solve_with_trace(bad, Tier::Easy), Err(PuzzleError::Description(_))));
    assert!(matches!(render_ascii(bad, None), Err(PuzzleError::Description(_))));
    assert!(matches!(solution_pairs(bad, &[]), Err(PuzzleError::Description(_))));
}

#[test]
fn tricky_uses_a_tricky_technique() {
    let g = generate(0, params(10, 10, Tier::Tricky)).unwrap();
    assert!(
        g.hints
            .iter()
            .any(|h| matches!(h.technique, tents::Technique::TreeCorner | tents::Technique::LineNeighbour))
    );
}

/// The game can be held as `&dyn PuzzleCheck`, so part 2's rota can be a
/// table of games rather than a match arm per game.
#[test]
fn works_through_a_dyn_reference() {
    let g = generate(1, params(8, 8, Tier::Easy)).unwrap();
    must_work_through_dyn::<Tents>(&g.description, &g.solution);
    let blank = vec![0u8; g.solution.len()];
    must_work_through_dyn::<Tents>(&g.description, &blank);
}

/// A description whose counts add up but whose only layouts put two
/// tents side by side. `line_count_exact` fills a line with tents on a
/// counting argument alone, and nothing downstream re-reads those
/// squares, so without the solver's soundness check this came back
/// `Solved` with a grid `check_rules` calls broken. Found by fuzzing
/// 2026-09-11.
#[test]
fn a_line_the_counts_fill_with_touching_tents_has_no_solution() {
    #[rustfmt::skip]
    let description: Vec<u8> = vec![
        1, 4, 4,
        // trees
        1, 0, 0, 0,
        0, 0, 0, 0,
        1, 0, 0, 0,
        0, 1, 0, 0,
        // row counts, then column counts
        1, 0, 1, 1,
        0, 2, 1, 0,
    ];
    for tier in Tier::ALL {
        let (_, solved) = solve_with_trace(&description, tier).unwrap();
        assert_eq!(solved, None, "{tier:?}: the solver claimed a grid with two tents touching");
    }
}

/// Tent layouts that are allowed to break the touching rule, with the row
/// and column counts taken from them. The counts add up, so the solver
/// gets a long way in, and no legal grid satisfies them. This is the
/// corpus that found the missing soundness check.
fn unsatisfiable_descriptions() -> Vec<Vec<u8>> {
    let mut rng = puzzle_core::Rng::new(20260911);
    let mut out = Vec::new();
    for (w, h) in [(4usize, 4usize), (5, 5), (6, 6)] {
        let n = w * h;
        for _ in 0..4_000 {
            let mut tent = vec![false; n];
            let mut tree = vec![false; n];
            for _ in 0..1 + rng.below(n / 3) {
                let c = rng.below(n);
                if tent[c] || tree[c] {
                    continue;
                }
                let free: Vec<usize> = puzzle_core::neighbours(w, h, c).filter(|&j| !tent[j] && !tree[j]).collect();
                if free.is_empty() {
                    continue;
                }
                tent[c] = true;
                tree[free[rng.below(free.len())]] = true;
            }
            let mut d = vec![1, w as u8, h as u8];
            d.extend((0..n).map(|i| tree[i] as u8));
            for y in 0..h {
                d.push((0..w).filter(|&x| tent[y * w + x]).count() as u8);
            }
            for x in 0..w {
                d.push((0..h).filter(|&y| tent[y * w + x]).count() as u8);
            }
            out.push(d);
        }
    }
    out
}

#[test]
fn the_solver_never_claims_an_unsound_grid() {
    let claimed = must_only_claim_sound_solutions::<Tents>(unsatisfiable_descriptions());
    assert!(claimed > 1_000, "only {claimed} of the corpus reached the solver");
}
