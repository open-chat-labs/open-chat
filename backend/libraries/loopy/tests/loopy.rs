use loopy::{
    Loopy, Params, Technique, Tier, Violation, check_rules, count_solutions, generate, is_complete, parse_description,
    render_ascii, solution_pairs, solve_with_trace,
};
use puzzle_core::testing::{
    must_generate, must_only_claim_sound_solutions, must_reject, must_terminate, must_work_through_dyn,
};
use puzzle_core::{Puzzle, PuzzleError};

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
    for (w, h) in [(4, 4), (5, 5), (6, 6), (6, 8), (8, 6), (8, 8), (10, 10)] {
        for tier in Tier::ALL {
            out.push(params(w, h, tier));
        }
    }
    out
}

#[test]
fn generated_6x6() {
    for tier in Tier::ALL {
        must_generate::<Loopy>(params(6, 6, tier), 0..SEEDS_PER_CONFIG);
    }
}

#[test]
fn generated_8x8() {
    for tier in Tier::ALL {
        must_generate::<Loopy>(params(8, 8, tier), 0..SEEDS_PER_CONFIG);
    }
}

/// Every size and tier this game accepts produces a puzzle. The point is
/// the parameter coverage: nothing in this generator used to bound its
/// retries, so a combination with no puzzle would have spun forever.
#[test]
fn every_playable_size_generates() {
    for p in playable() {
        must_generate::<Loopy>(p, 0..25);
    }
}

/// Sizes with no puzzle are turned away up front rather than searched for.
#[test]
fn impossible_sizes_are_rejected() {
    for (w, h) in [(0, 0), (1, 1), (2, 2), (2, 8), (8, 2)] {
        for tier in Tier::ALL {
            must_reject::<Loopy>(params(w, h, tier), 0..3);
        }
    }
}

/// The smallest grid the parameters allow carries an Easy puzzle but
/// usually has no Tricky one, and bigger grids have to return too.
/// Neither loop in this generator used to be bounded at all.
#[test]
fn extreme_sizes_terminate() {
    for (w, h) in [(3, 3), (3, 4), (4, 3), (12, 12), (3, 14), (14, 3)] {
        for tier in Tier::ALL {
            must_terminate::<Loopy>(params(w, h, tier), 0..2);
        }
    }
}

/// The smallest grid does carry an Easy puzzle.
#[test]
fn the_smallest_grid_generates_an_easy_puzzle() {
    must_generate::<Loopy>(params(3, 3, Tier::Easy), 0..10);
}

#[test]
fn single_edge_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(6, 6, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p).unwrap();
        for e in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[e] ^= 1;
            assert!(
                !Loopy::is_solved(&g.description, &grid).unwrap(),
                "seed {seed}: flipping edge {e} still counts as solved"
            );
        }
    }
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42, 6x6, Easy. Any change here means the
    // wire encoding or the generator's RNG stream drifted.
    const DESCRIPTION_HEX: &str = "010606ffffffff03ff0301ff02ffffffffff02ffff030002ff03ffff010102ffff0302ffff03ff";
    const SOLUTION_HEX: &str = "000100010001010000000100010000010000010001000100010000010100010001010001010100000100000101010101010100010100000100010100010001010000010001010001000000000101000100010100";
    let g = generate(42, params(6, 6, Tier::Easy)).unwrap();
    assert_eq!(hex(&g.description), DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), SOLUTION_HEX);
}

#[test]
fn tricky_uses_corner_pair_techniques() {
    let tricky = [Technique::CornerPairsFull, Technique::CornerPairsShort];
    for seed in 0..20 {
        let g = generate(seed, params(6, 6, Tier::Tricky)).unwrap();
        assert!(
            g.hints.iter().any(|h| tricky.contains(&h.technique)),
            "seed {seed}: tricky puzzle solved without a corner-pair deduction"
        );
        let easy = generate(seed, params(6, 6, Tier::Easy)).unwrap();
        assert!(
            easy.hints.iter().all(|h| !tricky.contains(&h.technique)),
            "seed {seed}: easy trace contains a tricky technique"
        );
    }
}

#[test]
fn parse_rejects_bad_input() {
    let good = generate(1, params(6, 6, Tier::Easy)).unwrap().description;
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
    assert!(parse_description(&[1, 0, 6]).is_err());

    for bad in [0x05, 0x10, 0x7f, 0xfe] {
        let mut bytes = good.clone();
        bytes[3] = bad;
        assert!(parse_description(&bytes).is_err(), "clue byte {bad:#04x} accepted");
    }
    // 4 is a legal clue: a loop can encircle a single cell.
    for ok in [0x00, 0x03, 0x04, 0xff] {
        let mut bytes = good.clone();
        bytes[3] = ok;
        assert!(parse_description(&bytes).is_ok(), "clue byte {ok:#04x} rejected");
    }

    let d = parse_description(&good).unwrap();
    assert_eq!(d.clues.len(), 36);
    assert_eq!(d.edge_count(), 84);
    assert!(d.clues.iter().any(|c| c.is_some()));
    assert!(d.clues.iter().any(|c| c.is_none()));
}

#[test]
fn render_ascii_has_tathams_layout() {
    let g = generate(3, params(8, 5, Tier::Easy)).unwrap();
    let puzzle = render_ascii(&g.description, None).unwrap();
    let solved = render_ascii(&g.description, Some(&g.solution)).unwrap();
    assert_eq!(puzzle.lines().count(), 11);
    assert_eq!(solved.lines().count(), 11);
    assert!(puzzle.lines().all(|l| l.chars().count() == 17));
    assert!(solved.lines().all(|l| l.chars().count() == 17));
    assert!(!puzzle.contains('-') && !puzzle.contains('|'));
    assert!(solved.contains('-') && solved.contains('|'));
    assert!(puzzle.starts_with("+ +"));
}

#[test]
fn check_rules_reports_each_violation_kind() {
    let g = generate(5, params(6, 6, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let n = d.edge_count();

    // Drawing an extra edge off the loop makes a degree-3 dot at one end.
    // The other end becomes a degree-1 dot, which is a loose end the
    // player has not tied up rather than a rule broken.
    let extra = (0..n).find(|&e| g.solution[e] == 0).unwrap();
    let mut grid = g.solution.clone();
    grid[extra] = 1;
    let violations = check_rules(&g.description, &grid).unwrap();
    let degrees: Vec<u8> = violations
        .iter()
        .filter_map(|v| match v {
            Violation::DotDegree { degree, .. } => Some(*degree),
            _ => None,
        })
        .collect();
    assert!(!degrees.is_empty(), "{violations:?}");
    assert!(degrees.iter().all(|&d| d >= 3), "{degrees:?}");
    assert!(!violations.iter().any(|v| matches!(v, Violation::ExtraLoop { .. })));

    // Two unit squares on an unclued 4x4: 40 edges, horizontals first
    // (5 rows of 4), then verticals (4 rows of 5).
    let mut desc = vec![1, 4, 4];
    desc.extend([0xff; 16]);
    let mut two_loops = vec![0u8; 40];
    for e in [0, 4, 20, 21, 11, 15, 33, 34] {
        two_loops[e] = 1;
    }
    let violations = check_rules(&desc, &two_loops).unwrap();
    assert_eq!(violations.len(), 1, "{violations:?}");
    assert!(matches!(&violations[0], Violation::ExtraLoop { edges } if edges.len() == 4));

    // A stray edge off one square is a degree problem, not a loop problem.
    two_loops[1] = 1;
    let violations = check_rules(&desc, &two_loops).unwrap();
    assert!(violations.iter().any(|v| matches!(v, Violation::DotDegree { .. })));
    assert!(!violations.iter().any(|v| matches!(v, Violation::ExtraLoop { .. })));
}

/// A clue short of its lines means the grid is unfinished, not broken.
/// This used to report every clue on an untouched board, so a client
/// asking "am I going wrong?" was told yes before the first move.
#[test]
fn an_untouched_board_is_incomplete_not_wrong() {
    let g = generate(5, params(6, 6, Tier::Easy)).unwrap();
    let empty = vec![0u8; g.solution.len()];
    assert!(check_rules(&g.description, &empty).unwrap().is_empty());
    assert!(!is_complete(&g.description, &empty).unwrap());
    assert!(!Loopy::is_solved(&g.description, &empty).unwrap());
}

/// A half-drawn loop is a path with two loose ends. Those used to be
/// reported as degree violations, which made every partial state look
/// wrong.
#[test]
fn a_half_drawn_loop_is_incomplete_not_wrong() {
    let g = generate(5, params(6, 6, Tier::Easy)).unwrap();
    let mut grid = g.solution.clone();
    let drawn = grid.iter().position(|&b| b == 1).unwrap();
    grid[drawn] = 0;
    assert!(
        check_rules(&g.description, &grid).unwrap().is_empty(),
        "{:?}",
        check_rules(&g.description, &grid)
    );
    assert!(!is_complete(&g.description, &grid).unwrap());
}

/// A clue with more lines round it than it allows can never come right.
#[test]
fn a_clue_over_its_count_is_a_violation() {
    let g = generate(5, params(6, 6, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let mut grid = g.solution.clone();
    // Fill every edge: every clue below 4 is then over its count.
    grid.fill(1);
    let violations = check_rules(&g.description, &grid).unwrap();
    let over: Vec<u16> = violations
        .iter()
        .filter_map(|v| match v {
            Violation::ClueCount { cell, .. } => Some(*cell),
            _ => None,
        })
        .collect();
    let clued: Vec<u16> = d
        .clues
        .iter()
        .enumerate()
        .filter(|(_, c)| c.is_some())
        .map(|(i, _)| i as u16)
        .collect();
    assert_eq!(over, clued, "every clue on a fully drawn grid is over its count");
}

/// A wrong-length grid is a caller bug. It used to read as a board with
/// no lines, which made a broken client look like an untouched puzzle.
#[test]
fn wrong_length_grids_are_rejected() {
    let g = generate(9, params(6, 6, Tier::Easy)).unwrap();
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

/// A byte this game gives no meaning to is reported, not read as a line.
#[test]
fn unknown_grid_bytes_are_rejected() {
    let g = generate(9, params(6, 6, Tier::Easy)).unwrap();
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
    let bad: &[u8] = &[1, 6, 6];
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
    let g = generate(1, params(6, 6, Tier::Easy)).unwrap();
    must_work_through_dyn::<Loopy>(&g.description, &g.solution);
    let blank = vec![0u8; g.solution.len()];
    must_work_through_dyn::<Loopy>(&g.description, &blank);
}

/// Clues taken from the boundary of a random two-colouring of the cells
/// rather than from a single loop. Every dot on such a boundary has an
/// even number of lines, so the clues add up and the local rules hold,
/// and what fails is the one rule that is not local: the lines form
/// several loops, not one.
fn unsatisfiable_descriptions() -> Vec<Vec<u8>> {
    let mut rng = puzzle_core::Rng::new(20260911);
    let mut out = Vec::new();
    for (w, h) in [(3usize, 3usize), (4, 4), (5, 5)] {
        let n = w * h;
        for _ in 0..4_000 {
            // The outside of the grid counts as the other colour, so the
            // border is part of the boundary.
            let inside: Vec<bool> = (0..n).map(|_| rng.below(3) == 0).collect();
            let at = |x: i32, y: i32| {
                (x >= 0 && y >= 0 && (x as usize) < w && (y as usize) < h) && inside[y as usize * w + x as usize]
            };
            let mut d = vec![1, w as u8, h as u8];
            for y in 0..h as i32 {
                for x in 0..w as i32 {
                    let me = at(x, y);
                    let clue = [(0, -1), (0, 1), (-1, 0), (1, 0)]
                        .into_iter()
                        .filter(|&(dx, dy)| at(x + dx, y + dy) != me)
                        .count() as u8;
                    // A board with every cell clued is easy to reject
                    // early; leaving gaps makes the solver work.
                    d.push(if rng.below(4) == 0 { 0xFF } else { clue });
                }
            }
            out.push(d);
        }
    }
    out
}

#[test]
fn the_solver_never_claims_an_unsound_grid() {
    let claimed = must_only_claim_sound_solutions::<Loopy>(unsatisfiable_descriptions());
    assert!(claimed > 100, "only {claimed} of the corpus reached the solver");
}
