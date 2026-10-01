use puzzle_core::testing::{
    must_generate, must_only_claim_sound_solutions, must_reject, must_terminate, must_work_through_dyn,
};
use puzzle_core::{Puzzle, PuzzleError, Tier};
use unruly::{
    EMPTY, Params, Unruly, VALUE_A, VALUE_B, Violation, check_rules, count_solutions, generate, is_complete, parse_description,
    render_ascii, solve_with_trace,
};

const SEEDS_PER_CONFIG: u64 = 20;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    Params::default_for(width, height, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// The sizes The Daily can serve. Both tiers of each, so a size that
/// cannot carry Tricky fails here and not in the canister.
fn playable() -> Vec<Params> {
    let mut out = Vec::new();
    for (w, h) in [(6, 6), (6, 8), (8, 6), (8, 8), (10, 8), (10, 10), (12, 12), (14, 14)] {
        for tier in Tier::ALL {
            out.push(params(w, h, tier));
        }
    }
    out
}

#[test]
fn generated_8x8() {
    for tier in Tier::ALL {
        must_generate::<Unruly>(params(8, 8, tier), 0..SEEDS_PER_CONFIG);
    }
}

#[test]
fn generated_10x10() {
    for tier in Tier::ALL {
        must_generate::<Unruly>(params(10, 10, tier), 0..SEEDS_PER_CONFIG);
    }
}

/// Every size and tier this game accepts produces a puzzle. The point is
/// the parameter coverage: a combination that could never generate used
/// to spin forever instead of failing a test.
#[test]
fn every_playable_size_generates() {
    for p in playable() {
        must_generate::<Unruly>(p, 0..5);
    }
}

/// Sizes with no puzzle are turned away up front rather than searched for.
#[test]
fn impossible_sizes_are_rejected() {
    for (w, h) in [(0, 0), (2, 2), (4, 4), (4, 8), (8, 4), (7, 8), (8, 7), (7, 7)] {
        for tier in Tier::ALL {
            must_reject::<Unruly>(params(w, h, tier), 0..3);
        }
    }
}

/// Sizes at the edge of what is playable still have to return.
#[test]
fn odd_sizes_terminate() {
    for (w, h) in [(6, 20), (20, 6), (16, 16)] {
        for tier in Tier::ALL {
            must_terminate::<Unruly>(params(w, h, tier), 0..2);
        }
    }
}

#[test]
fn tricky_puzzles_defeat_the_easy_solver() {
    for seed in 0..20 {
        let g = generate(seed, params(8, 8, Tier::Tricky)).unwrap();
        assert!(
            solve_with_trace(&g.description, Tier::Easy).unwrap().1.is_none(),
            "seed {seed}: easy solver finished a tricky puzzle"
        );
    }
}

#[test]
fn givens_agree_with_the_solution() {
    for seed in 0..20 {
        let g = generate(seed, params(8, 8, Tier::Easy)).unwrap();
        let d = parse_description(&g.description).unwrap();
        for (i, &v) in d.givens.iter().enumerate() {
            assert!(v == EMPTY || v == g.solution[i], "seed {seed}: given {i} disagrees");
        }
    }
}

#[test]
fn single_cell_perturbation_is_caught() {
    for seed in 0..20 {
        let p = params(8, 8, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p).unwrap();
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] = if grid[i] == VALUE_A { VALUE_B } else { VALUE_A };
            assert!(
                !check_rules(&g.description, &grid).unwrap().is_empty(),
                "seed {seed}: flipping cell {i} went unnoticed"
            );
            assert!(
                !Unruly::is_solved(&g.description, &grid).unwrap(),
                "seed {seed}: flipping cell {i} still counts as solved"
            );
        }
    }
}

/// A full grid that obeys every rule but overwrites a given is not this
/// puzzle's solution, and must not pass as one.
#[test]
fn overwriting_a_given_is_a_violation() {
    let g = generate(5, params(8, 8, Tier::Easy)).unwrap();
    let d = parse_description(&g.description).unwrap();
    let cell = d.givens.iter().position(|&v| v != EMPTY).unwrap();
    let mut grid = g.solution.clone();
    let other = if grid[cell] == VALUE_A { VALUE_B } else { VALUE_A };
    grid[cell] = other;
    assert!(
        check_rules(&g.description, &grid)
            .unwrap()
            .contains(&Violation::ContradictsGiven {
                cell: cell as u16,
                given: d.givens[cell],
                actual: other,
            })
    );
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42. Any change here means the wire encoding
    // or the generator's RNG stream drifted.
    const EASY_DESCRIPTION_HEX: &str = "01080802000200010100000200000000000002000000000000000000020002000000010000010000000000000200000202000000000000000001000000020001000002";
    const EASY_SOLUTION_HEX: &str = "02010202010102010202010102010102010102010202010201020102010202010201010201010202010202010202010102020101020201010101020201010202";
    let g = generate(42, params(8, 8, Tier::Easy)).unwrap();
    assert_eq!(hex(&g.description), EASY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), EASY_SOLUTION_HEX);

    const TRICKY_DESCRIPTION_HEX: &str = "010a0a01000001000000000000000200000000000000000002000200000000000201000000010000000000000000000000020001000100000000000000000000000000000202000100000200000000000000020100000000000200020001000001000000020002";
    const TRICKY_SOLUTION_HEX: &str = "01010201020201020201020201010201020102010202010201010201010201010202010201020201020201010201020101020101020201020102020102010102010202010102020201010201010201020101020201020201020101020201020101020102";
    let g = generate(42, params(10, 10, Tier::Tricky)).unwrap();
    assert_eq!(hex(&g.description), TRICKY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), TRICKY_SOLUTION_HEX);
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

/// Every entry point that takes a description reports a malformed one the
/// same way, instead of one panicking and the next returning a default.
#[test]
fn malformed_descriptions_are_reported_not_guessed() {
    let bad: &[u8] = &[1, 7, 8];
    assert!(matches!(check_rules(bad, &[]), Err(PuzzleError::Description(_))));
    assert!(matches!(is_complete(bad, &[]), Err(PuzzleError::Description(_))));
    assert!(matches!(count_solutions(bad, 2), Err(PuzzleError::Description(_))));
    assert!(matches!(solve_with_trace(bad, Tier::Easy), Err(PuzzleError::Description(_))));
    assert!(matches!(render_ascii(bad, None), Err(PuzzleError::Description(_))));
    assert!(matches!(unruly::solution_pairs(bad, &[]), Err(PuzzleError::Description(_))));
}

#[test]
fn render_ascii_has_tathams_shape() {
    let g = generate(3, params(10, 8, Tier::Easy)).unwrap();
    let puzzle = render_ascii(&g.description, None).unwrap();
    let solved = render_ascii(&g.description, Some(&g.solution)).unwrap();
    assert_eq!(puzzle.lines().count(), 8);
    assert_eq!(solved.lines().count(), 8);
    assert!(puzzle.lines().all(|l| l.chars().count() == 20));
    assert!(puzzle.contains('.'), "puzzle should have blanks");
    assert!(solved.contains('0') && solved.contains('1'));
    assert!(!solved.contains('.'), "solved grid should have no blanks");
}

/// Description with no givens at all.
fn blank(w: u8, h: u8) -> Vec<u8> {
    let mut d = vec![1, w, h];
    d.extend(std::iter::repeat_n(0, w as usize * h as usize));
    d
}

#[test]
fn check_rules_reports_runs() {
    // 6x6 is the smallest grid this game has, so each line takes three
    // of each value and a fourth is what overfills it.
    let d = blank(6, 6);
    let mut grid = vec![EMPTY; 36];
    assert!(
        check_rules(&d, &grid).unwrap().is_empty(),
        "empty grid is incomplete, not wrong"
    );

    // Three in a row across the top, still within the row's allowance.
    grid[0] = VALUE_A;
    grid[1] = VALUE_A;
    grid[2] = VALUE_A;
    assert_eq!(
        check_rules(&d, &grid).unwrap(),
        vec![Violation::Run {
            cells: vec![0, 1, 2],
            value: VALUE_A
        }]
    );

    // A fourth makes two overlapping runs and overfills the row.
    grid[3] = VALUE_A;
    assert_eq!(
        check_rules(&d, &grid).unwrap(),
        vec![
            Violation::Run {
                cells: vec![0, 1, 2],
                value: VALUE_A
            },
            Violation::Run {
                cells: vec![1, 2, 3],
                value: VALUE_A
            },
            Violation::RowCount {
                row: 0,
                value: VALUE_A,
                count: 4
            }
        ]
    );

    // The same down the left, with the rest of the column blank.
    let mut grid = vec![EMPTY; 36];
    grid[0] = VALUE_B;
    grid[6] = VALUE_B;
    grid[12] = VALUE_B;
    grid[18] = VALUE_B;
    assert_eq!(
        check_rules(&d, &grid).unwrap(),
        vec![
            Violation::Run {
                cells: vec![0, 6, 12],
                value: VALUE_B
            },
            Violation::Run {
                cells: vec![6, 12, 18],
                value: VALUE_B
            },
            Violation::ColumnCount {
                column: 0,
                value: VALUE_B,
                count: 4
            }
        ]
    );
}

#[test]
fn check_rules_reports_counts() {
    let d = blank(6, 6);
    let mut grid = vec![EMPTY; 36];
    // Four of a value in one row without three of them in a row.
    grid[0] = VALUE_A;
    grid[1] = VALUE_A;
    grid[2] = VALUE_B;
    grid[3] = VALUE_A;
    grid[4] = VALUE_A;
    grid[5] = VALUE_B;
    assert_eq!(
        check_rules(&d, &grid).unwrap(),
        vec![Violation::RowCount {
            row: 0,
            value: VALUE_A,
            count: 4
        }]
    );
    // Three of each is fine.
    grid[4] = VALUE_B;
    assert!(check_rules(&d, &grid).unwrap().is_empty());
}

#[test]
fn partial_solution_is_incomplete_not_wrong() {
    let g = generate(9, params(8, 8, Tier::Tricky)).unwrap();
    let mut grid = g.solution.clone();
    for b in grid.iter_mut().step_by(2) {
        *b = EMPTY;
    }
    assert!(check_rules(&g.description, &grid).unwrap().is_empty());
    assert!(!is_complete(&g.description, &grid).unwrap());
    assert!(!Unruly::is_solved(&g.description, &grid).unwrap());
}

/// A wrong-length grid is a caller bug. It used to read as an empty
/// board, which made a broken client look like an untouched puzzle.
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

/// A byte this game gives no meaning to is reported, not read as empty.
#[test]
fn unknown_grid_bytes_are_rejected() {
    let g = generate(9, params(8, 8, Tier::Easy)).unwrap();
    for byte in [3u8, 0x80, 0xff] {
        let mut grid = g.solution.clone();
        grid[5] = byte;
        assert_eq!(
            check_rules(&g.description, &grid),
            Err(PuzzleError::GridValue { cell: 5, byte })
        );
    }
}

#[test]
fn count_solutions_finds_ambiguity() {
    // A 6x6 grid with nothing given has many solutions.
    assert_eq!(count_solutions(&blank(6, 6), 2).unwrap(), 2);
}

/// The game can be held as `&dyn PuzzleCheck`, so part 2's rota can be a
/// table of games rather than a match arm per game.
#[test]
fn works_through_a_dyn_reference() {
    let g = generate(1, params(8, 8, Tier::Easy)).unwrap();
    must_work_through_dyn::<Unruly>(&g.description, &g.solution);
    let blank = vec![0u8; g.solution.len()];
    must_work_through_dyn::<Unruly>(&g.description, &blank);
}

/// Boards the generator would never emit: a legal full grid with a
/// random part of it blanked, and half the time one surviving given
/// flipped to the other value so that nothing satisfies it. Unlike the
/// other five games, dense nonsense is rejected on the first pass here,
/// because this solver checks runs and line counts before it does
/// anything; what is worth pushing on is whether `Solved` can come back
/// on a board its own rule check calls broken.
fn unsatisfiable_descriptions() -> Vec<Vec<u8>> {
    let mut rng = puzzle_core::Rng::new(20260911);
    let mut out = Vec::new();
    for (w, h) in [(6u8, 6u8), (8, 8)] {
        for tier in Tier::ALL {
            let Ok(g) = generate(0, params(w, h, tier)) else {
                continue;
            };
            for _ in 0..3_000 {
                let mut d = vec![1, w, h];
                d.extend(g.solution.iter().map(|&v| if rng.below(10) < 3 { EMPTY } else { v }));
                if rng.below(2) == 0 {
                    let given: Vec<usize> = (3..d.len()).filter(|&i| d[i] != EMPTY).collect();
                    if !given.is_empty() {
                        let i = given[rng.below(given.len())];
                        d[i] = if d[i] == VALUE_A { VALUE_B } else { VALUE_A };
                    }
                }
                out.push(d);
            }
        }
    }
    out
}

#[test]
fn the_solver_never_claims_an_unsound_grid() {
    let claimed = must_only_claim_sound_solutions::<Unruly>(unsatisfiable_descriptions());
    assert!(claimed > 100, "only {claimed} of the corpus reached the solver");
}

/// Whether `values` (keyed by cell, `EMPTY` where unknown) breaks a rule
/// that lies wholly inside `scope`: a window of three with all three the
/// same, or a whole line with more than its share of a value.
fn breaks_a_rule_in(w: usize, h: usize, scope: &[usize], values: &[u8]) -> bool {
    let inside = |k: usize| scope.contains(&k);
    for &k in scope {
        let (x, y) = (k % w, k / w);
        let v = values[k];
        if v == EMPTY {
            continue;
        }
        for (dx, dy) in [(1, 0), (0, 1)] {
            if x + 2 * dx >= w || y + 2 * dy >= h {
                continue;
            }
            let (k2, k3) = (k + dx + dy * w, k + 2 * (dx + dy * w));
            if inside(k2) && inside(k3) && values[k2] == v && values[k3] == v {
                return true;
            }
        }
    }
    let rows = (0..h).map(|y| (0..w).map(|x| y * w + x).collect::<Vec<_>>());
    let cols = (0..w).map(|x| (0..h).map(|y| y * w + x).collect::<Vec<_>>());
    rows.chain(cols).filter(|line| line.iter().all(|&k| inside(k))).any(|line| {
        [VALUE_A, VALUE_B]
            .iter()
            .any(|&v| line.iter().filter(|&&k| values[k] == v).count() > line.len() / 2)
    })
}

/// Every filling of the scope's empty cells that breaks no rule lying
/// wholly inside the scope, by backtracking over them in order.
fn fillings(w: usize, h: usize, scope: &[usize], values: &mut Vec<u8>, empty: &[usize], out: &mut Vec<Vec<u8>>) {
    if breaks_a_rule_in(w, h, scope, values) {
        return;
    }
    let Some((&k, rest)) = empty.split_first() else {
        out.push(values.clone());
        return;
    };
    for v in [VALUE_A, VALUE_B] {
        values[k] = v;
        fillings(w, h, scope, values, rest, out);
    }
    values[k] = EMPTY;
}

/// Invariant 23: every step lists in its focus every cell it relies on.
/// The LocalUserIndex's premise walk (#9588) serves a hint's premises by
/// following its focus, so a cell left out is one the player can be
/// missing while the hint reads as proven. Checked structurally: with the
/// board before the step cut down to the focus, and only the rules that
/// lie wholly inside the focus (a window of three, a whole line's count),
/// every filling of the focus's empty cells agrees with the conclusions.
#[test]
fn every_step_follows_from_its_focus() {
    for p in playable() {
        for seed in 0..5 {
            let g = generate(seed, p).unwrap();
            let d = parse_description(&g.description).unwrap();
            let (w, h) = (d.width as usize, d.height as usize);
            let mut board = d.givens.clone();
            for (i, step) in g.hints.iter().enumerate() {
                let ctx = format!("{p:?} seed {seed} step {i} ({:?})", step.technique);
                let scope: Vec<usize> = step.focus.iter().map(|&k| k as usize).collect();
                for &(k, _) in &step.conclusions {
                    assert!(scope.contains(&(k as usize)), "{ctx}: conclusion {k} is outside the focus");
                }
                let mut values = vec![EMPTY; w * h];
                for &k in &scope {
                    values[k] = board[k];
                }
                let empty: Vec<usize> = scope.iter().copied().filter(|&k| board[k] == EMPTY).collect();
                let mut out = Vec::new();
                fillings(w, h, &scope, &mut values, &empty, &mut out);
                assert!(!out.is_empty(), "{ctx}: the focus admits no filling at all");
                for filling in &out {
                    for &(k, v) in &step.conclusions {
                        assert_eq!(
                            filling[k as usize], v,
                            "{ctx}: the focus alone does not force cell {k}; the step relies on a cell outside it"
                        );
                    }
                }
                for &(k, v) in &step.conclusions {
                    board[k as usize] = v;
                }
            }
        }
    }
}

/// Writes the hint steps of a spread of generated puzzles to the client's
/// fixture, which `unruly.spec.ts` reads to check every step gets a
/// sentence naming the right row or column and colour (invariant 24). Run
/// by hand when the solver's steps change:
/// `cargo test -p unruly --test unruly write_hint_fixture -- --ignored`
fn hint_fixture() -> (std::path::PathBuf, String) {
    let mut entries = Vec::new();
    for (w, h, tier, seeds) in [
        (6u8, 6u8, Tier::Easy, 0..2u64),
        (8, 8, Tier::Easy, 0..4),
        (8, 6, Tier::Tricky, 0..2),
        (6, 8, Tier::Tricky, 0..2),
        (8, 8, Tier::Tricky, 0..3),
        (10, 10, Tier::Tricky, 0..2),
    ] {
        for seed in seeds {
            let g = generate(seed, params(w, h, tier)).unwrap();
            let steps: Vec<String> = g
                .hints
                .iter()
                .map(|h| {
                    format!(
                        "{{\"technique\":{},\"focus\":{:?},\"target\":{:?},\"conclusions\":{:?}}}",
                        u8::from(h.technique),
                        h.focus,
                        h.target,
                        h.conclusions.iter().map(|&(k, v)| [k as u32, v as u32]).collect::<Vec<_>>()
                    )
                })
                .collect();
            entries.push(format!(
                "{{\"description\":\"{}\",\"steps\":[{}]}}",
                hex(&g.description),
                steps.join(",")
            ));
        }
    }
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../frontend/openchat-shared/src/utils/dailyGames/unrulyHints.json");
    (path, format!("[{}]\n", entries.join(",")))
}

#[test]
#[ignore]
fn write_hint_fixture() {
    let (path, json) = hint_fixture();
    std::fs::write(path, json).unwrap();
}

/// #9675: invariant 24's client test reads a fixture of this solver's steps, so it proves nothing
/// once the solver moves on. The committed fixture must be exactly what the solver emits now.
/// Compared without whitespace, because prettier reflows the committed file.
#[test]
fn hint_fixture_is_current() {
    let (path, json) = hint_fixture();
    let strip = |s: &str| s.chars().filter(|c| !c.is_whitespace()).collect::<String>();
    let committed = std::fs::read_to_string(&path).unwrap_or_default();
    assert_eq!(
        strip(&committed),
        strip(&json),
        "{} is stale: run `cargo test -p unruly --test unruly write_hint_fixture -- --ignored`",
        path.display()
    );
}
