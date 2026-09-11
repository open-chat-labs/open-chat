//! A conformance harness every game runs from its integration tests.
//!
//! The point is coverage of parameters rather than of code. Each game's
//! own tests used to pin two hard-coded grid sizes, which is why
//! parameter combinations that could never generate went unnoticed until
//! they hung. Drive [`must_generate`] and [`must_terminate`] from the
//! whole range a game accepts and a combination that cannot produce a
//! puzzle fails the build instead of the canister.

use crate::{GenerateError, Generated, Puzzle, PuzzleCheck, PuzzleError, Tier};
use std::collections::BTreeMap;

/// Generate at every seed and check everything that is true of every
/// game's output. Panics with the failing seed and parameters.
pub fn must_generate<P: Puzzle>(params: P::Params, seeds: impl IntoIterator<Item = u64>) {
    for seed in seeds {
        let ctx = format!("{} seed {seed} {:?}", P::GAME_ID, params);
        let generated = match P::generate(seed, params) {
            Ok(g) => g,
            Err(e) => panic!("{ctx}: expected a puzzle, got {e}"),
        };
        check_generated::<P>(&generated, params, seed, &ctx);
    }
}

/// Generation returns, whatever it returns. A puzzle is checked as in
/// [`must_generate`]; a `GenerateError` is accepted, because plenty of
/// legal parameter combinations genuinely have no puzzle. What is not
/// accepted is a panic, and what the test proves by finishing is that
/// nothing loops forever.
pub fn must_terminate<P: Puzzle>(params: P::Params, seeds: impl IntoIterator<Item = u64>) {
    for seed in seeds {
        let ctx = format!("{} seed {seed} {:?}", P::GAME_ID, params);
        if let Ok(generated) = P::generate(seed, params) {
            check_generated::<P>(&generated, params, seed, &ctx);
        }
    }
}

/// These parameters describe no puzzle of this game at any seed, and
/// generation says so up front rather than searching.
pub fn must_reject<P: Puzzle>(params: P::Params, seeds: impl IntoIterator<Item = u64>) {
    for seed in seeds {
        let ctx = format!("{} seed {seed} {:?}", P::GAME_ID, params);
        match P::generate(seed, params) {
            Err(GenerateError::InvalidParams(_)) => {}
            Err(e) => panic!("{ctx}: expected InvalidParams, got {e}"),
            Ok(_) => panic!("{ctx}: expected InvalidParams, got a puzzle"),
        }
    }
}

fn check_generated<P: Puzzle>(g: &Generated<P::Technique>, params: P::Params, seed: u64, ctx: &str) {
    let description = g.description.as_slice();
    let keys = g.pairs.len();

    P::parse_description(description).unwrap_or_else(|e| panic!("{ctx}: own description does not parse: {e}"));

    let again = P::generate(seed, params).unwrap_or_else(|e| panic!("{ctx}: second generate failed: {e}"));
    assert_eq!(&again, g, "{ctx}: generation is not deterministic");

    assert_eq!(
        P::count_solutions(description, 2).unwrap_or_else(|e| panic!("{ctx}: count_solutions: {e}")),
        1,
        "{ctx}: puzzle is not uniquely solvable"
    );

    let (hints, solved) = P::solve_with_trace(description, g.tier).unwrap_or_else(|e| panic!("{ctx}: solve_with_trace: {e}"));
    assert_eq!(
        solved.as_deref(),
        Some(g.solution.as_slice()),
        "{ctx}: the trace does not reach the stored solution"
    );
    assert_eq!(&hints, &g.hints, "{ctx}: the stored trace is not the one the solver produces");

    assert_eq!(
        P::solution_pairs(description, &g.solution).unwrap_or_else(|e| panic!("{ctx}: solution_pairs: {e}")),
        g.pairs,
        "{ctx}: stored pairs are not the solution's pairs"
    );

    let violations = P::check_rules(description, &g.solution).unwrap_or_else(|e| panic!("{ctx}: check_rules: {e}"));
    assert!(violations.is_empty(), "{ctx}: the solution breaks the rules: {violations:?}");
    assert!(
        P::is_complete(description, &g.solution).unwrap_or_else(|e| panic!("{ctx}: is_complete: {e}")),
        "{ctx}: the solution is not complete"
    );
    assert!(
        P::is_solved(description, &g.solution).unwrap_or_else(|e| panic!("{ctx}: is_solved: {e}")),
        "{ctx}: the solution does not count as solved"
    );

    check_blank_grid::<P>(description, g.solution.len(), ctx);
    check_grid_length::<P>(description, g.solution.len(), ctx);
    check_hints::<P>(g, keys, ctx);

    let ascii = P::render_ascii(description, None).unwrap_or_else(|e| panic!("{ctx}: render_ascii: {e}"));
    assert!(!ascii.is_empty(), "{ctx}: render_ascii produced nothing");
    P::render_ascii(description, Some(&g.solution)).unwrap_or_else(|e| panic!("{ctx}: render_ascii with grid: {e}"));
}

/// A board the player has not touched is incomplete, and incompleteness
/// is never a rule violation. Every game encodes "undecided" as a zero
/// byte, so the blank board is zeroes.
fn check_blank_grid<P: Puzzle>(description: &[u8], len: usize, ctx: &str) {
    let blank = vec![0u8; len];
    let violations = P::check_rules(description, &blank).unwrap_or_else(|e| panic!("{ctx}: check_rules(blank): {e}"));
    assert!(
        violations.is_empty(),
        "{ctx}: a blank board is incomplete, not wrong, but check_rules reported {violations:?}"
    );
    assert!(
        !P::is_complete(description, &blank).unwrap_or_else(|e| panic!("{ctx}: is_complete(blank): {e}")),
        "{ctx}: a blank board counts as complete"
    );
}

/// A grid of the wrong length is a caller bug and is reported, not
/// quietly read as an empty board.
fn check_grid_length<P: Puzzle>(description: &[u8], len: usize, ctx: &str) {
    for wrong in [Vec::new(), vec![0u8; len + 1]] {
        let actual = wrong.len();
        assert_eq!(
            P::check_rules(description, &wrong),
            Err(PuzzleError::GridLength { expected: len, actual }),
            "{ctx}: check_rules accepted a {actual}-byte grid"
        );
        assert_eq!(
            P::is_complete(description, &wrong),
            Err(PuzzleError::GridLength { expected: len, actual }),
            "{ctx}: is_complete accepted a {actual}-byte grid"
        );
    }
}

/// Every conclusion agrees with the solution, no key is decided twice,
/// and each step points at keys it actually looked at.
///
/// `focus` is deliberately not checked against the solution keys: some
/// games highlight things a solution never mentions, such as Slant's
/// vertex clues or Loopy's dots.
fn check_hints<P: Puzzle>(g: &Generated<P::Technique>, keys: usize, ctx: &str) {
    let pairs: BTreeMap<u16, u8> = g.pairs.iter().copied().collect();
    assert_eq!(pairs.len(), keys, "{ctx}: pairs repeat a key");

    let mut decided: BTreeMap<u16, u8> = BTreeMap::new();
    for (step, hint) in g.hints.iter().enumerate() {
        let where_ = format!("{ctx}: hint {step} ({:?})", hint.technique);
        assert!(!hint.target.is_empty(), "{where_}: has no target");
        for key in &hint.target {
            assert!(hint.focus.contains(key), "{where_}: target {key} is not in focus");
        }
        assert!(!hint.conclusions.is_empty(), "{where_}: concludes nothing");
        for &(key, value) in &hint.conclusions {
            match pairs.get(&key) {
                None => panic!("{where_}: concludes about {key}, which is not a solution key"),
                Some(&want) => assert_eq!(value, want, "{where_}: concludes {key} = {value}, solution says {want}"),
            }
            assert!(decided.insert(key, value).is_none(), "{where_}: decides {key} a second time");
        }
    }
}

/// A solver is allowed to give up. It is not allowed to claim it has
/// finished on a grid its own rule check calls broken.
///
/// Feed this descriptions built to be unsatisfiable while still adding
/// up: a layout that breaks a rule, with the clues derived from it, so
/// the counts are consistent and the solver gets a long way in before
/// anything contradicts it. Generated puzzles cannot reach that state,
/// which is why the rest of the harness never found the Tents solver
/// reporting `Solved` on a grid with two tents touching. Byte-level
/// mutation of a good description does not reach it either: 148,800
/// mutants found nothing, and the first hand-built illegal layout found
/// it in seconds.
///
/// Returns how many descriptions the solver actually claimed to solve,
/// so a test can fail a corpus that never reached the solver at all
/// rather than passing on vacuum.
pub fn must_only_claim_sound_solutions<P: Puzzle>(descriptions: impl IntoIterator<Item = Vec<u8>>) -> usize {
    let mut claimed = 0;
    for description in descriptions {
        for tier in Tier::ALL {
            let Ok((_, Some(solution))) = P::solve_with_trace(&description, tier) else {
                continue;
            };
            claimed += 1;
            let ctx = format!("{} {tier:?}: solved {description:?} as {solution:?}", P::GAME_ID);
            let violations = P::check_rules(&description, &solution).unwrap_or_else(|e| panic!("{ctx}, but check_rules: {e}"));
            assert!(violations.is_empty(), "{ctx}, but that breaks the rules: {violations:?}");
            assert!(
                P::is_complete(&description, &solution).unwrap_or_else(|e| panic!("{ctx}, but is_complete: {e}")),
                "{ctx}, which is not complete"
            );
        }
    }
    claimed
}

/// The game can be held as `&dyn PuzzleCheck`, which is what lets a
/// caller keep a table of games instead of a match arm per game. Answers
/// reached through the table match the ones reached directly.
pub fn must_work_through_dyn<P: Puzzle + Default>(description: &[u8], grid: &[u8]) {
    let game: &dyn PuzzleCheck = &P::default();
    assert_eq!(game.game_id(), P::GAME_ID);
    assert_eq!(game.accepts_description(description), Ok(()));
    assert_eq!(
        game.has_violations(description, grid),
        P::check_rules(description, grid).map(|v| !v.is_empty())
    );
    assert_eq!(game.is_complete(description, grid), P::is_complete(description, grid));
    assert_eq!(game.is_solved(description, grid), P::is_solved(description, grid));
    assert_eq!(game.count_solutions(description, 2), P::count_solutions(description, 2));
}
