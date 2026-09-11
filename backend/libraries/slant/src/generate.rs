use crate::solver::{Outcome, solve};
use crate::state::State;
use crate::{Generated, MAX_ATTEMPTS, Params, Tier, encode_description, encode_slash, solution_pairs, solve_with_trace};
use puzzle_core::{Budget, Dsf, GenerateError, Rng, side_ok, side_too_big};

/// Port of `slant_generate`: fill the cells in random order, choosing at
/// random unless one slash would close a loop. Never has to backtrack
/// (Gareth Taylor's chessboard argument in slant.c).
fn slant_generate(w: usize, h: usize, rng: &mut Rng) -> State {
    let mut st = State::new(w, h);
    let mut connected = Dsf::new(st.vertices());
    let mut indices: Vec<usize> = (0..w * h).collect();
    rng.shuffle(&mut indices);
    for i in indices {
        let (b1, b2) = st.endpoints(i, -1);
        let (f1, f2) = st.endpoints(i, 1);
        let fs = connected.equivalent(b1, b2);
        let bs = connected.equivalent(f1, f2);
        debug_assert!(!(fs && bs));
        let v: i8 = if fs {
            1
        } else if bs {
            -1
        } else {
            2 * rng.below(2) as i8 - 1
        };
        st.soln[i] = v;
        let (a, b) = st.endpoints(i, v);
        connected.merge(a, b);
    }
    st
}

/// Every vertex gets its true diagonal count.
fn full_clues(st: &mut State) {
    let vw = st.vw();
    for vy in 0..=st.h {
        for vx in 0..vw {
            let (nb, n) = st.vertex_neighbours(vx, vy);
            let count = nb[..n].iter().filter(|&&(j, s)| st.soln[j] == s).count();
            st.clues[vy * vw + vx] = Some(count as u8);
        }
    }
}

fn solves(st: &State, tier: Tier) -> Outcome {
    let mut work = st.clone();
    solve(&mut work, tier, None)
}

/// Reject sizes this game has no puzzle for, before any searching.
fn validate(params: Params) -> Result<(usize, usize), GenerateError> {
    let (w, h) = (params.width as usize, params.height as usize);
    if w < 2 || h < 2 {
        return Err(GenerateError::invalid(format!(
            "width and height must be at least 2, got {w}x{h}"
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
    let mut budget = Budget::new(MAX_ATTEMPTS);
    let (vw, nv) = (w + 1, (w + 1) * (h + 1));

    loop {
        budget.spend()?;
        let mut st = slant_generate(w, h, &mut rng);
        let solution: Vec<u8> = st.soln.iter().map(|&v| encode_slash(v)).collect();
        full_clues(&mut st);
        // Checked at runtime rather than with debug_assert, which the
        // wasm build compiles out: a fully clued grid the solver cannot
        // finish would mean the clues and the solution disagree.
        if solves(&st, Tier::Easy) != Outcome::Solved {
            continue;
        }

        // Strip clues while the puzzle stays solvable at this tier. On
        // Tricky, obvious starting points (4s, 0s, border 2s, corner 1s)
        // go in the first pass so as many of them as possible are removed.
        let mut order: Vec<usize> = (0..nv).collect();
        rng.shuffle(&mut order);
        for pass in 0..2 {
            for &vertex in &order {
                let Some(v) = st.clues[vertex] else {
                    continue;
                };
                let (vx, vy) = (vertex % vw, vertex / vw);
                let xb = vx == 0 || vx == w;
                let yb = vy == 0 || vy == h;
                let obvious = v == 4 || v == 0 || (v == 2 && (xb || yb)) || (v == 1 && xb && yb);
                let this_pass = if tier == Tier::Easy || obvious { 0 } else { 1 };
                if this_pass != pass {
                    continue;
                }
                st.clues[vertex] = None;
                if solves(&st, tier) != Outcome::Solved {
                    st.clues[vertex] = Some(v);
                }
            }
        }

        if tier == Tier::Tricky && solves(&st, Tier::Easy) != Outcome::Stuck {
            continue;
        }

        let description = encode_description(&st);
        // Also a runtime check: a puzzle whose hints lead somewhere other
        // than its stored solution must never reach a player.
        let Ok((hints, solved)) = solve_with_trace(&description, tier) else {
            continue;
        };
        // ... and one that needs no deductions at all has nothing to
        // show a player who asks for a hint.
        if solved.as_deref() != Some(solution.as_slice()) || hints.is_empty() {
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
