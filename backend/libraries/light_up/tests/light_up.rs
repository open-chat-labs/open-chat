use light_up::{
    Cell, LightUp, Params, Symmetry, Tier, Violation, check_rules, count_solutions, generate, is_complete, parse_description,
    render_ascii, solution_pairs, solve_with_trace,
};
use puzzle_core::testing::{must_generate, must_reject, must_terminate, must_work_through_dyn};
use puzzle_core::{Puzzle, PuzzleError};

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

/// The sizes The Daily can serve, both tiers of each.
fn playable() -> Vec<Params> {
    let mut out = Vec::new();
    for (w, h) in [(5, 5), (6, 6), (7, 7), (7, 10), (10, 7), (10, 10), (12, 12)] {
        for tier in Tier::ALL {
            out.push(params(w, h, tier));
        }
    }
    out
}

#[test]
fn generated_7x7() {
    for tier in Tier::ALL {
        must_generate::<LightUp>(params(7, 7, tier), 0..SEEDS_PER_CONFIG);
    }
}

#[test]
fn generated_10x10() {
    for tier in Tier::ALL {
        must_generate::<LightUp>(params(10, 10, tier), 0..SEEDS_PER_CONFIG);
    }
}

/// Every size and tier this game accepts produces a puzzle. The point is
/// the parameter coverage: a combination that could never generate used
/// to spin forever instead of failing a test.
#[test]
fn every_playable_size_generates() {
    for p in playable() {
        must_generate::<LightUp>(p, 0..25);
    }
}

/// Every density and symmetry the parameters allow, at a size big enough
/// to carry them.
#[test]
fn every_density_and_symmetry_generates() {
    for black_pct in [5, 10, 20, 30, 40] {
        for symmetry in [Symmetry::None, Symmetry::Rot2, Symmetry::Rot4, Symmetry::Ref2, Symmetry::Ref4] {
            for tier in Tier::ALL {
                must_generate::<LightUp>(
                    Params {
                        width: 8,
                        height: 8,
                        black_pct,
                        symmetry,
                        tier,
                    },
                    0..3,
                );
            }
        }
    }
}

/// A density that blacks out the whole board leaves nothing to light and
/// no hints. It used to pass validation and hand back a finished puzzle.
#[test]
fn impossible_densities_are_rejected() {
    for black_pct in [0, 1, 4, 96, 100, 255] {
        for tier in Tier::ALL {
            must_reject::<LightUp>(
                Params {
                    width: 8,
                    height: 8,
                    black_pct,
                    symmetry: Symmetry::Rot2,
                    tier,
                },
                0..3,
            );
        }
    }
}

#[test]
fn impossible_sizes_are_rejected() {
    for (w, h) in [(0, 0), (1, 1), (1, 8), (8, 1)] {
        for tier in Tier::ALL {
            must_reject::<LightUp>(params(w, h, tier), 0..3);
        }
    }
}

/// Grids too small to carry a puzzle at all, or too small to carry the
/// harder tier, used to spin forever. They now come back one way or the
/// other, which is what finishing this test proves.
#[test]
fn tiny_grids_terminate() {
    for (w, h) in [(2, 2), (2, 3), (3, 2), (3, 3), (4, 4), (2, 10), (10, 2)] {
        for tier in Tier::ALL {
            for symmetry in [Symmetry::None, Symmetry::Rot2, Symmetry::Rot4] {
                must_terminate::<LightUp>(
                    Params {
                        width: w,
                        height: h,
                        black_pct: 20,
                        symmetry,
                        tier,
                    },
                    0..3,
                );
            }
        }
    }
}

/// Density near the top of the range, where most boards come out unusable.
#[test]
fn high_densities_terminate() {
    for black_pct in [50, 70, 90, 95] {
        for tier in Tier::ALL {
            must_terminate::<LightUp>(
                Params {
                    width: 7,
                    height: 7,
                    black_pct,
                    symmetry: Symmetry::Rot2,
                    tier,
                },
                0..3,
            );
        }
    }
}

#[test]
fn tricky_puzzles_defeat_the_easy_solver() {
    for seed in 0..20 {
        let g = generate(seed, params(7, 7, Tier::Tricky)).unwrap();
        assert!(
            solve_with_trace(&g.description, Tier::Easy).unwrap().1.is_none(),
            "seed {seed}: easy solver finished a tricky puzzle"
        );
    }
}

#[test]
fn single_cell_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(7, 7, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p).unwrap();
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] ^= 1;
            assert!(
                !LightUp::is_solved(&g.description, &grid).unwrap(),
                "seed {seed}: flipping cell {i} still counts as solved"
            );
        }
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
    let g = generate(3, params(10, 7, Tier::Easy)).unwrap();
    let puzzle = render_ascii(&g.description, None).unwrap();
    let solved = render_ascii(&g.description, Some(&g.solution)).unwrap();
    assert_eq!(puzzle.lines().count(), 7);
    assert_eq!(solved.lines().count(), 7);
    assert!(puzzle.lines().all(|l| l.len() == 10));
    assert!(solved.contains('O'));
    assert!(!solved.contains('.'), "solved grid should have no unlit cells");
}

#[test]
fn check_rules_reports_each_violation_kind() {
    let g = generate(5, params(7, 7, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let black = d.cells.iter().position(|c| matches!(c, Cell::Black(_))).unwrap();
    let mut grid = g.solution.clone();
    grid[black] = 1;
    assert!(
        check_rules(&g.description, &grid)
            .unwrap()
            .contains(&Violation::BulbOnBlack { cell: black as u16 })
    );

    let mut seeing = g.solution.clone();
    let bulb = seeing.iter().position(|&b| b == 1).unwrap();
    let right = bulb + 1;
    if right % 7 != 0 && matches!(d.cells[right], Cell::White) {
        seeing[right] = 1;
        assert!(
            check_rules(&g.description, &seeing)
                .unwrap()
                .contains(&Violation::BulbSeesBulb {
                    a: bulb as u16,
                    b: right as u16
                })
        );
    }
}

/// A clue with too few bulbs beside it means the grid is unfinished, not
/// broken. Only too many is a rule broken. This used to report every
/// unlit cell and every unmet clue on an untouched board, so a client
/// asking "am I going wrong?" was told yes before the first move.
#[test]
fn an_untouched_board_is_incomplete_not_wrong() {
    let g = generate(5, params(7, 7, Tier::Easy)).unwrap();
    let empty = vec![0u8; g.solution.len()];
    assert!(check_rules(&g.description, &empty).unwrap().is_empty());
    assert!(!is_complete(&g.description, &empty).unwrap());
    assert!(!LightUp::is_solved(&g.description, &empty).unwrap());
}

/// Two bulbs beside a clue that only wants one is definitely wrong,
/// whatever the player does next.
#[test]
fn a_clue_with_too_many_bulbs_is_a_violation() {
    let g = generate(5, params(7, 7, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let w = d.width as usize;
    let (clue, expected) = d
        .cells
        .iter()
        .enumerate()
        .find_map(|(i, c)| match c {
            Cell::Black(Some(n)) if *n < 2 && i % w > 0 && i % w + 1 < w => Some((i, *n)),
            _ => None,
        })
        .expect("a clue with room for two more bulbs beside it");
    let mut grid = vec![0u8; g.solution.len()];
    grid[clue - 1] = 1;
    grid[clue + 1] = 1;
    assert!(check_rules(&g.description, &grid).unwrap().contains(&Violation::ClueCount {
        clue: clue as u16,
        expected,
        actual: 2
    }));
}

/// A wrong-length grid is a caller bug. It used to read as a board with
/// no bulbs, which made a broken client look like an untouched puzzle.
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

/// A byte this game gives no meaning to is reported, not read as no bulb.
#[test]
fn unknown_grid_bytes_are_rejected() {
    let g = generate(9, params(7, 7, Tier::Easy)).unwrap();
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
    must_work_through_dyn::<LightUp>(&g.description, &g.solution);
    let blank = vec![0u8; g.solution.len()];
    must_work_through_dyn::<LightUp>(&g.description, &blank);
}
