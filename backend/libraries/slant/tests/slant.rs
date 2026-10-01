use puzzle_core::testing::{
    must_generate, must_only_claim_sound_solutions, must_reject, must_terminate, must_work_through_dyn,
};
use puzzle_core::{Puzzle, PuzzleError, Tier};
use slant::{
    BACKSLASH, Params, SLASH, Slant, Technique, Violation, check_rules, count_solutions, generate, is_complete,
    parse_description, render_ascii, solution_pairs, solve_with_trace,
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
    for (w, h) in [(4, 4), (5, 5), (6, 6), (6, 8), (8, 6), (8, 8), (10, 10), (12, 12)] {
        for tier in Tier::ALL {
            out.push(params(w, h, tier));
        }
    }
    out
}

#[test]
fn generated_6x6() {
    for tier in Tier::ALL {
        must_generate::<Slant>(params(6, 6, tier), 0..SEEDS_PER_CONFIG);
    }
}

#[test]
fn generated_8x8() {
    for tier in Tier::ALL {
        must_generate::<Slant>(params(8, 8, tier), 0..SEEDS_PER_CONFIG);
    }
}

/// Every size and tier this game accepts produces a puzzle. The point is
/// the parameter coverage: a combination that could never generate used
/// to spin forever instead of failing a test.
#[test]
fn every_playable_size_generates() {
    for p in playable() {
        must_generate::<Slant>(p, 0..25);
    }
}

/// Sizes with no puzzle are turned away up front rather than searched for.
#[test]
fn impossible_sizes_are_rejected() {
    for (w, h) in [(0, 0), (1, 1), (1, 8), (8, 1)] {
        for tier in Tier::ALL {
            must_reject::<Slant>(params(w, h, tier), 0..3);
        }
    }
}

/// The smallest and largest grids still have to return, whether or not
/// they have a puzzle.
#[test]
fn extreme_sizes_terminate() {
    for (w, h) in [(2, 2), (2, 3), (3, 2), (3, 3), (2, 20), (20, 2), (16, 16)] {
        for tier in Tier::ALL {
            must_terminate::<Slant>(params(w, h, tier), 0..3);
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
fn single_cell_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(6, 6, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p).unwrap();
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] = if grid[i] == BACKSLASH { SLASH } else { BACKSLASH };
            assert!(
                !check_rules(&g.description, &grid).unwrap().is_empty(),
                "seed {seed}: flipping cell {i} went unnoticed"
            );
            assert!(
                !Slant::is_solved(&g.description, &grid).unwrap(),
                "seed {seed}: flipping cell {i} still counts as solved"
            );
        }
    }
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42. Any change here means the wire encoding
    // or the generator's RNG stream drifted.
    const EASY_DESCRIPTION_HEX: &str =
        "01060600ffffff010101ffffff030203ff0202ff02ffff01ffff0103ffffffff03ff0202ff00ff0102ff01ffffffffffffff01ff";
    const EASY_SOLUTION_HEX: &str = "020101020202020202020201010101010101010102010102020102010101010102010202";
    let g = generate(42, params(6, 6, Tier::Easy)).unwrap();
    assert_eq!(hex(&g.description), EASY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), EASY_SOLUTION_HEX);

    const TRICKY_DESCRIPTION_HEX: &str = "010808ffffffffffffffffffff0101ff0301ff01ffff030302ffff02ff010102ff0201ff0201ffff0201ffff02ffff01ff0103ffffff01ff01ff03ffff01ff0201ffff02030102ff0301ffff01ffffff01ffffff";
    const TRICKY_SOLUTION_HEX: &str = "02020102020102010102020201010101020201010102020102020101020101010101010202010101010201020101020102020201010102020202010101010102";
    let g = generate(42, params(8, 8, Tier::Tricky)).unwrap();
    assert_eq!(hex(&g.description), TRICKY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), TRICKY_SOLUTION_HEX);
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
    let g = generate(3, params(8, 6, Tier::Easy)).unwrap();
    let puzzle = render_ascii(&g.description, None).unwrap();
    let solved = render_ascii(&g.description, Some(&g.solution)).unwrap();
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
    let violations = check_rules(&d, &grid).unwrap();
    assert_eq!(violations.len(), 1);
    let Violation::Loop { cells } = &violations[0] else {
        panic!("expected a loop, got {violations:?}");
    };
    let mut sorted = cells.clone();
    sorted.sort_unstable();
    assert_eq!(sorted, vec![4, 5, 7, 8]);

    // Break the diamond: no loop, and empty cells are not violations.
    grid[8] = BACKSLASH;
    assert!(check_rules(&d, &grid).unwrap().is_empty());
    assert!(check_rules(&d, &[0u8; 9]).unwrap().is_empty());
}

#[test]
fn check_rules_reports_vertex_counts() {
    // 2x2 grid, centre vertex (index 4 of the 3x3 vertex grid) clued 4.
    let mut d = clueless(2, 2);
    d[3 + 4] = 4;

    assert!(
        check_rules(&d, &[0u8; 4]).unwrap().is_empty(),
        "empty grid is incomplete, not wrong"
    );
    // Three cells pointing in is still achievable.
    assert!(check_rules(&d, &[BACKSLASH, SLASH, SLASH, 0]).unwrap().is_empty());
    // One cell pointing away makes 4 impossible.
    assert_eq!(
        check_rules(&d, &[SLASH, 0, 0, 0]).unwrap(),
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
        check_rules(&d, &[BACKSLASH, 0, 0, 0]).unwrap(),
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
    let g = generate(9, params(6, 6, Tier::Tricky)).unwrap();
    let mut grid = g.solution.clone();
    for b in grid.iter_mut().step_by(2) {
        *b = 0;
    }
    assert!(check_rules(&g.description, &grid).unwrap().is_empty());
    assert!(!is_complete(&g.description, &grid).unwrap());
    assert!(!Slant::is_solved(&g.description, &grid).unwrap());
}

/// A wrong-length grid is a caller bug. It used to read as an empty
/// board, which made a broken client look like an untouched puzzle.
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

/// A byte this game gives no meaning to is reported, not read as
/// undecided.
#[test]
fn unknown_grid_bytes_are_rejected() {
    let g = generate(9, params(6, 6, Tier::Easy)).unwrap();
    for byte in [3u8, 0x80, 0xff] {
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

#[test]
fn hint_focus_keys_are_in_range() {
    for seed in 0..20 {
        let g = generate(seed, params(8, 8, Tier::Tricky)).unwrap();
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

/// The game can be held as `&dyn PuzzleCheck`, so part 2's rota can be a
/// table of games rather than a match arm per game.
#[test]
fn works_through_a_dyn_reference() {
    let g = generate(1, params(6, 6, Tier::Easy)).unwrap();
    must_work_through_dyn::<Slant>(&g.description, &g.solution);
    let blank = vec![0u8; g.solution.len()];
    must_work_through_dyn::<Slant>(&g.description, &blank);
}

/// Diagonal layouts that are allowed to close a loop, with every vertex
/// clue taken from them. The clues add up, so the solver gets a long way
/// in, and no legal grid satisfies them.
fn unsatisfiable_descriptions() -> Vec<Vec<u8>> {
    let mut rng = puzzle_core::Rng::new(20260911);
    let mut out = Vec::new();
    for (w, h) in [(3usize, 3usize), (4, 4), (5, 5)] {
        let (n, vw, nv) = (w * h, w + 1, (w + 1) * (h + 1));
        for _ in 0..4_000 {
            // 1 = backslash (top-left to bottom-right), 2 = slash.
            let cells: Vec<u8> = (0..n).map(|_| 1 + rng.below(2) as u8).collect();
            let mut clues = vec![0u8; nv];
            for (i, &v) in cells.iter().enumerate() {
                let (x, y) = (i % w, i / w);
                let (a, b) = if v == 1 { (y * vw + x, (y + 1) * vw + x + 1) } else { (y * vw + x + 1, (y + 1) * vw + x) };
                clues[a] += 1;
                clues[b] += 1;
            }
            let mut d = vec![1, w as u8, h as u8];
            // Keep a random subset of the clues; a fully clued board is
            // easier for the solver to reject early.
            d.extend(clues.iter().map(|&c| if rng.below(4) == 0 { 0xFF } else { c }));
            out.push(d);
        }
    }
    out
}

#[test]
fn the_solver_never_claims_an_unsound_grid() {
    let claimed = must_only_claim_sound_solutions::<Slant>(unsatisfiable_descriptions());
    assert!(claimed > 1_000, "only {claimed} of the corpus reached the solver");
}

/// Cells around vertex `v` of a `w`x`h` grid, each with the value (1 = backslash, 2 = slash)
/// that would put a line on the vertex.
fn cells_round(w: usize, h: usize, v: usize) -> Vec<(usize, u8)> {
    let (vx, vy) = (v % (w + 1), v / (w + 1));
    let mut out = Vec::new();
    if vx > 0 && vy > 0 {
        out.push(((vy - 1) * w + vx - 1, BACKSLASH));
    }
    if vx > 0 && vy < h {
        out.push((vy * w + vx - 1, SLASH));
    }
    if vx < w && vy < h {
        out.push((vy * w + vx, BACKSLASH));
    }
    if vx < w && vy > 0 {
        out.push(((vy - 1) * w + vx, SLASH));
    }
    out
}

/// The two vertices a line of `value` in cell `i` joins.
fn corners(w: usize, i: usize, value: u8) -> (usize, usize) {
    let (x, y, vw) = (i % w, i / w, w + 1);
    if value == BACKSLASH {
        (y * vw + x, (y + 1) * vw + x + 1)
    } else {
        (y * vw + x + 1, (y + 1) * vw + x)
    }
}

fn other(value: u8) -> u8 {
    if value == BACKSLASH { SLASH } else { BACKSLASH }
}

/// Invariant 23: a step lists in its focus what it relies on. Every Slant conclusion is a line,
/// never a "no line", so the LocalUserIndex's premise walk (#9588), which follows negatives-only
/// steps, never applies: a step is served only once every earlier step is on the board. What is
/// left is that the focus shows the premises the step reads off that board:
/// - a clue step lists its clue and every cell round it
/// - LoopAvoidance lists a chain of cells, all decided before it, joining the two corners the
///   other slant would join
/// - Equivalence lists a cell decided before it with the slant it concludes
/// - DeadEndAvoidance lists the two corners the other slant would join (the two groups
///   themselves are cut to their members nearest the cell, `MAX_DEAD_END_FOCUS`)
///
/// Equivalence and PairedClue also rest on ties between cells that the solver works out in its
/// v-shape pass, which records no step and so leaves no cells to list.
#[test]
fn every_step_lists_what_it_relies_on() {
    for p in playable() {
        for seed in 0..10 {
            let g = generate(seed, p).unwrap();
            let d = parse_description(&g.description).unwrap();
            let (w, h) = (d.width as usize, d.height as usize);
            let n = w * h;
            let mut board = vec![0u8; n];
            for (s, hint) in g.hints.iter().enumerate() {
                let ctx = format!("{w}x{h} {:?} seed {seed} step {s} ({:?})", p.tier, hint.technique);
                assert!(
                    hint.conclusions.iter().all(|&(_, v)| v == BACKSLASH || v == SLASH),
                    "{ctx}: concludes something other than a line"
                );
                let listed = |k: usize| hint.focus.contains(&(k as u16));
                let premises: Vec<usize> = hint
                    .focus
                    .iter()
                    .map(|&k| k as usize)
                    .filter(|&k| k < n && !hint.conclusions.iter().any(|&(c, _)| c as usize == k))
                    .collect();
                match hint.technique {
                    Technique::ClueSatisfied | Technique::ClueForced | Technique::PairedClue => {
                        let v = hint.target[0] as usize - n;
                        assert!(d.clues[v].is_some(), "{ctx}: the target is not a clue");
                        for (c, _) in cells_round(w, h, v) {
                            assert!(listed(c), "{ctx}: cell {c} round the clue is not in the focus");
                        }
                    }
                    Technique::LoopAvoidance | Technique::Equivalence | Technique::DeadEndAvoidance => {
                        let (cell, value) = (hint.conclusions[0].0 as usize, hint.conclusions[0].1);
                        let (a, b) = corners(w, cell, other(value));
                        for &c in &premises {
                            assert!(board[c] != 0, "{ctx}: focus cell {c} is not decided yet");
                        }
                        match hint.technique {
                            Technique::LoopAvoidance => {
                                // Walk the listed lines out from one corner: they must reach the other
                                let mut reached = vec![a];
                                let mut i = 0;
                                while i < reached.len() {
                                    let v = reached[i];
                                    for &c in &premises {
                                        let (x, y) = corners(w, c, board[c]);
                                        for (from, to) in [(x, y), (y, x)] {
                                            if from == v && !reached.contains(&to) {
                                                reached.push(to);
                                            }
                                        }
                                    }
                                    i += 1;
                                }
                                assert!(reached.contains(&b), "{ctx}: the listed cells do not join the corners");
                            }
                            Technique::Equivalence => {
                                assert!(
                                    premises.iter().any(|&c| board[c] == value),
                                    "{ctx}: no listed cell holds the slant it copies"
                                );
                            }
                            _ => {
                                for corner in [a, b] {
                                    assert!(listed(n + corner), "{ctx}: corner {corner} is not in the focus");
                                }
                            }
                        }
                    }
                }
                for &(k, v) in &hint.conclusions {
                    board[k as usize] = v;
                }
            }
        }
    }
}

/// Invariant 24: a PairedClue step's target is its clue and the two neighbouring cells it ties,
/// none of them concluded, so that at level 2 the sentence can point at the pair by its solid
/// outline and at the cells it settles by their ?.
#[test]
fn a_paired_clue_step_targets_the_pair_it_ties() {
    let mut seen = 0;
    for p in playable().into_iter().filter(|p| p.tier == Tier::Tricky) {
        for seed in 0..10 {
            let g = generate(seed, p).unwrap();
            let d = parse_description(&g.description).unwrap();
            let (w, h) = (d.width as usize, d.height as usize);
            for hint in g.hints.iter().filter(|h| h.technique == Technique::PairedClue) {
                seen += 1;
                let ctx = format!("{w}x{h} seed {seed}: {hint:?}");
                let v = hint.target[0] as usize - w * h;
                let round: Vec<u16> = cells_round(w, h, v).iter().map(|&(c, _)| c as u16).collect();
                let pair = &hint.target[1..];
                assert_eq!(pair.len(), 2, "{ctx}: the target does not name a pair");
                assert!(
                    pair.iter().all(|c| round.contains(c)),
                    "{ctx}: the pair is not round the clue"
                );
                let (x0, y0) = (pair[0] as usize % w, pair[0] as usize / w);
                let (x1, y1) = (pair[1] as usize % w, pair[1] as usize / w);
                assert_eq!(x0.abs_diff(x1) + y0.abs_diff(y1), 1, "{ctx}: the pair are not neighbours");
                assert!(
                    !hint.conclusions.iter().any(|(k, _)| pair.contains(k)),
                    "{ctx}: the step concludes a cell of the pair"
                );
            }
        }
    }
    assert!(seen > 0, "no PairedClue step in the corpus");
}

/// Writes the hint steps of a spread of generated puzzles to the client's fixture, which
/// `slant.spec.ts` reads to check every step gets a sentence naming the right clue, corners or
/// cell (invariant 24). Run by hand when the solver's steps change:
/// `cargo test -p slant --test slant write_hint_fixture -- --ignored`
fn hint_fixture() -> (std::path::PathBuf, String) {
    let mut entries = Vec::new();
    for (size, tier, seeds) in [(6u8, Tier::Easy, 0..4u64), (6, Tier::Tricky, 0..4), (8, Tier::Tricky, 0..3)] {
        for seed in seeds {
            let g = generate(seed, params(size, size, tier)).unwrap();
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
        .join("../../../frontend/openchat-shared/src/utils/dailyGames/slantHints.json");
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
        "{} is stale: run `cargo test -p slant --test slant write_hint_fixture -- --ignored`",
        path.display()
    );
}
