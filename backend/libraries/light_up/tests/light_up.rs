use light_up::{
    Cell, Description, LightUp, Params, Symmetry, Technique, Tier, Violation, check_rules, count_solutions, generate,
    is_complete, parse_description, render_ascii, solution_pairs, solve_with_trace,
};
use puzzle_core::testing::{
    must_generate, must_only_claim_sound_solutions, must_reject, must_terminate, must_work_through_dyn,
};
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

/// Bulb layouts that are allowed to break the "no bulb sees another"
/// rule, with every black square's clue taken from them. The clues add
/// up, so the solver gets a long way in, and no legal grid satisfies
/// them.
fn unsatisfiable_descriptions() -> Vec<Vec<u8>> {
    let mut rng = puzzle_core::Rng::new(20260911);
    let mut out = Vec::new();
    for (w, h) in [(4usize, 4usize), (5, 5), (6, 6)] {
        let n = w * h;
        for _ in 0..4_000 {
            let mut black = vec![false; n];
            for _ in 0..rng.below(n / 3 + 1) {
                black[rng.below(n)] = true;
            }
            let mut bulb = vec![false; n];
            for _ in 0..1 + rng.below(n / 3) {
                let c = rng.below(n);
                if !black[c] {
                    bulb[c] = true;
                }
            }
            let mut d = vec![1, w as u8, h as u8];
            for (i, &is_black) in black.iter().enumerate() {
                d.push(if is_black {
                    0x11 + puzzle_core::neighbours(w, h, i).filter(|&j| bulb[j]).count() as u8
                } else {
                    0x00
                });
            }
            out.push(d);
        }
    }
    out
}

#[test]
fn the_solver_never_claims_an_unsound_grid() {
    let claimed = must_only_claim_sound_solutions::<LightUp>(unsatisfiable_descriptions());
    assert!(claimed > 1_000, "only {claimed} of the corpus reached the solver");
}

/// The board as the solver's trace has left it: the bulbs and the ruled-out cells its steps
/// have concluded so far.
struct Board<'a> {
    d: &'a Description,
    bulb: Vec<bool>,
    out: Vec<bool>,
}

impl Board<'_> {
    fn width(&self) -> usize {
        self.d.width as usize
    }

    fn white(&self, i: usize) -> bool {
        self.d.cells[i] == Cell::White
    }

    /// The white cells a bulb at `i` would light, up to the nearest black cell or edge, not
    /// counting `i` itself.
    fn sight(&self, i: usize) -> Vec<usize> {
        let (w, h) = (self.width() as isize, self.d.height as isize);
        let (x, y) = ((i as isize) % w, (i as isize) / w);
        let mut out = Vec::new();
        for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            let (mut cx, mut cy) = (x + dx, y + dy);
            while cx >= 0 && cy >= 0 && cx < w && cy < h && self.white((cy * w + cx) as usize) {
                out.push((cy * w + cx) as usize);
                cx += dx;
                cy += dy;
            }
        }
        out
    }

    fn neighbours(&self, i: usize) -> Vec<usize> {
        puzzle_core::neighbours(self.width(), self.d.height as usize, i).collect()
    }

    fn lit(&self, i: usize) -> bool {
        self.bulb[i] || self.sight(i).iter().any(|&j| self.bulb[j])
    }

    /// A white cell that can still take a bulb.
    fn free(&self, i: usize) -> bool {
        self.white(i) && !self.out[i] && !self.lit(i)
    }

    fn bulbs_beside(&self, clue: usize) -> usize {
        self.neighbours(clue).into_iter().filter(|&j| self.bulb[j]).count()
    }

    /// The free cells a bulb at `x` would rule out: those it shines on, and the other free cells
    /// beside a number it would complete.
    fn ruled_out_by(&self, x: usize) -> Vec<usize> {
        let mut out: Vec<usize> = self.sight(x).into_iter().filter(|&j| self.free(j)).collect();
        for nb in self.neighbours(x) {
            if let Cell::Black(Some(clue)) = self.d.cells[nb]
                && self.bulbs_beside(nb) + 1 == clue as usize
            {
                out.extend(self.neighbours(nb).into_iter().filter(|&j| j != x && self.free(j)));
            }
        }
        out
    }
}

/// What a step can reason about: a dark cell with its line of sight, or a number with the white
/// cells beside it.
enum Unit {
    Dark(usize),
    Clue(usize),
}

impl Unit {
    fn cells(&self, b: &Board) -> Vec<usize> {
        match *self {
            Unit::Dark(u) => [vec![u], b.sight(u)].concat(),
            Unit::Clue(c) => [vec![c], b.neighbours(c).into_iter().filter(|&j| b.white(j)).collect()].concat(),
        }
    }

    /// Whether this unit alone, on the board before the step, proves the step's conclusions.
    fn proves(&self, b: &Board, hint: &light_up::Hint) -> bool {
        let free: Vec<usize> = self.cells(b).into_iter().filter(|&j| b.free(j)).collect();
        let concluded = |value: u8| {
            let mut keys: Vec<usize> = hint
                .conclusions
                .iter()
                .filter(|c| c.1 == value)
                .map(|c| c.0 as usize)
                .collect();
            keys.sort_unstable();
            keys
        };
        let sorted = |mut v: Vec<usize>| {
            v.sort_unstable();
            v
        };
        match (hint.technique, self) {
            (Technique::OnlyOneWayToLight, Unit::Dark(u)) => !b.lit(*u) && free.len() == 1 && concluded(1) == free,
            (Technique::ClueSatisfied, Unit::Clue(c)) => {
                let Cell::Black(Some(clue)) = b.d.cells[*c] else {
                    return false;
                };
                b.bulbs_beside(*c) == clue as usize && concluded(0) == sorted(free) && concluded(1).is_empty()
            }
            (Technique::ClueForced, Unit::Clue(c)) => {
                let Cell::Black(Some(clue)) = b.d.cells[*c] else {
                    return false;
                };
                b.bulbs_beside(*c) + free.len() == clue as usize && concluded(1) == sorted(free) && concluded(0).is_empty()
            }
            (Technique::SetExclusion, unit) => {
                let [(x, 0)] = hint.conclusions[..] else { return false };
                let x = x as usize;
                let ruled = b.ruled_out_by(x);
                match *unit {
                    Unit::Dark(u) => !b.lit(u) && !free.is_empty() && free.iter().all(|j| ruled.contains(j)),
                    Unit::Clue(c) => {
                        let Cell::Black(Some(clue)) = b.d.cells[c] else { return false };
                        let beside = b.neighbours(c).contains(&x) as usize;
                        let left = free.iter().filter(|&&j| j != x && !ruled.contains(&j)).count();
                        b.bulbs_beside(c) + beside + left < clue as usize
                    }
                }
            }
            _ => false,
        }
    }
}

/// Invariant 23: a step lists every cell it relies on. Each step reasons about one dark cell
/// and its line of sight, or one number and the white cells beside it, and that unit lies whole
/// in the step's focus and, on the board the trace has built so far, proves the step's
/// conclusions alone. So the cells the step relies on having been ruled out are listed with it.
/// The LocalUserIndex serves the steps a hint rests on by following its focus (#9588), so a
/// ruled-out cell left out of the focus is a premise the player can be missing while the hint
/// reads as proven: a set exclusion "at least one of these must hold a bulb" with another cell
/// that could light the dark cell still open on the player's board.
#[test]
fn every_step_lists_the_cells_it_relies_on() {
    for (w, h) in [(7u8, 7u8), (10, 10), (7, 10)] {
        for tier in Tier::ALL {
            for seed in 0..30 {
                let g = generate(seed, params(w, h, tier)).unwrap();
                let d = parse_description(&g.description).unwrap();
                let n = d.cells.len();
                let mut b = Board {
                    d: &d,
                    bulb: vec![false; n],
                    out: vec![false; n],
                };
                for (s, hint) in g.hints.iter().enumerate() {
                    let listed = |unit: &Unit| unit.cells(&b).iter().all(|&k| hint.focus.contains(&(k as u16)));
                    let units = (0..n)
                        .filter(|&i| b.white(i))
                        .map(Unit::Dark)
                        .chain((0..n).filter(|&i| matches!(d.cells[i], Cell::Black(Some(_)))).map(Unit::Clue));
                    assert!(
                        units.into_iter().any(|u| listed(&u) && u.proves(&b, hint)),
                        "{w}x{h} {tier:?} seed {seed} step {s} ({:?}): no unit listed whole in the focus {:?} proves {:?}",
                        hint.technique,
                        hint.focus,
                        hint.conclusions
                    );
                    for &(k, v) in &hint.conclusions {
                        if v == 1 {
                            b.bulb[k as usize] = true;
                        } else {
                            b.out[k as usize] = true;
                        }
                    }
                }
            }
        }
    }
}

/// Writes the hint steps of a spread of generated puzzles to the client's fixture, which
/// `lightUp.spec.ts` reads to check every step gets a sentence naming the right number or cell
/// (invariant 24). Run by hand when the solver's steps change:
/// `cargo test -p light_up --test light_up write_hint_fixture -- --ignored`
fn hint_fixture() -> (std::path::PathBuf, String) {
    let mut entries = Vec::new();
    for (size, tier, seeds) in [(7u8, Tier::Easy, 0..3u64), (7, Tier::Tricky, 0..3), (10, Tier::Tricky, 0..6)] {
        for seed in seeds {
            // The rota's symmetry, not this file's Rot4 for square grids
            let g = generate(
                seed,
                Params {
                    symmetry: Symmetry::Rot2,
                    ..params(size, size, tier)
                },
            )
            .unwrap();
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
        .join("../../../frontend/openchat-shared/src/utils/dailyGames/lightUpHints.json");
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
        "{} is stale: run `cargo test -p light_up --test light_up write_hint_fixture -- --ignored`",
        path.display()
    );
}
