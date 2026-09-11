use crate::solver::{Outcome, solve};
use crate::state::State;
use crate::{EMPTY, Generated, MAX_WORK, Params, Tier, VALUE_A, VALUE_B, encode_description, solution_pairs, solve_with_trace};
use puzzle_core::{Budget, GenerateError, Rng, side_ok, side_too_big};

/// Port of `unruly_fill_game`: pick empty cells in random order, guess one
/// at random, and let the full-strength technique solver propagate. Unlike
/// the other games this can paint itself into a corner, so the caller
/// retries when the result is not a valid full grid.
///
/// One solve per guessed cell, all charged to the budget: this loop and
/// the stripping loop, not the attempt count, are where a generate call
/// spends its instructions.
fn fill_game(st: &mut State, rng: &mut Rng, budget: &mut Budget) -> Result<bool, GenerateError> {
    let mut spaces: Vec<usize> = (0..st.size()).collect();
    rng.shuffle(&mut spaces);
    for i in spaces {
        if st.grid[i] != EMPTY {
            continue;
        }
        budget.spend()?;
        st.grid[i] = if rng.below(2) != 0 { VALUE_A } else { VALUE_B };
        solve(st, Tier::Tricky, None);
    }
    Ok(st.filled() && st.sound())
}

/// Reject sizes this game has no puzzle for, before any searching.
fn validate(params: Params) -> Result<(usize, usize), GenerateError> {
    let (w, h) = (params.width as usize, params.height as usize);
    if w < 6 || h < 6 {
        return Err(GenerateError::invalid(format!(
            "width and height must be at least 6, got {w}x{h}"
        )));
    }
    if w % 2 != 0 || h % 2 != 0 {
        return Err(GenerateError::invalid(format!(
            "width and height must both be even, got {w}x{h}"
        )));
    }
    if !side_ok(w, h) {
        return Err(GenerateError::invalid(side_too_big(w, h)));
    }
    Ok((w, h))
}

/// Port of `new_game_desc`.
pub(crate) fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    let (w, h) = validate(params)?;
    let tier = params.tier;
    let mut rng = Rng::new(seed);
    let mut budget = Budget::new(MAX_WORK);

    loop {
        budget.spend()?;
        // A random valid full grid. Retries draw from the same stream, so
        // every attempt uses fresh derived randomness. Tatham's fill can
        // paint itself into a corner, so it too has to be able to give up.
        let mut st = loop {
            budget.spend()?;
            let mut st = State::new(w, h);
            if fill_game(&mut st, &mut rng, &mut budget)? {
                break st;
            }
        };
        let solution = st.grid.clone();

        // Blank cells one at a time, keeping the ones the technique solver
        // turns out to need.
        let mut spaces: Vec<usize> = (0..w * h).collect();
        rng.shuffle(&mut spaces);
        for i in spaces {
            budget.spend()?;
            let given = st.grid[i];
            st.grid[i] = EMPTY;
            let mut work = st.clone();
            if solve(&mut work, tier, None) != Outcome::Solved {
                st.grid[i] = given;
            }
        }

        // See if the game has accidentally come out too easy.
        if tier == Tier::Tricky {
            budget.spend()?;
            let mut work = st.clone();
            if solve(&mut work, Tier::Easy, None) != Outcome::Stuck {
                continue;
            }
        }

        let description = encode_description(&st);
        // Checked at runtime, not with debug_assert: these are compiled
        // out of the wasm build, and a puzzle whose hints lead somewhere
        // other than its stored solution must never reach a player.
        let Ok((hints, solved)) = solve_with_trace(&description, tier) else {
            continue;
        };
        // A puzzle that needs no deductions at all has nothing to show a
        // player who asks for a hint, either.
        if solved.as_deref() != Some(solution.as_slice()) || hints.is_empty() {
            continue;
        }
        if !solution.iter().all(|&v| v == VALUE_A || v == VALUE_B) {
            continue;
        }
        let Ok(pairs) = solution_pairs(&description, &solution) else {
            continue;
        };
        return Ok(Generated {
            description,
            solution,
            hints,
            pairs,
            tier,
        });
    }
}
