use crate::rng::Rng;
use crate::solver::{Outcome, solve};
use crate::state::State;
use crate::{EMPTY, Generated, Params, Tier, VALUE_A, VALUE_B, encode_description, solution_pairs, solve_with_trace};

/// Port of `unruly_fill_game`: pick empty cells in random order, guess one
/// at random, and let the full-strength technique solver propagate. Unlike
/// the other games this can paint itself into a corner, so the caller
/// retries when the result is not a valid full grid.
fn fill_game(st: &mut State, rng: &mut Rng) -> bool {
    let mut spaces: Vec<usize> = (0..st.size()).collect();
    rng.shuffle(&mut spaces);
    for i in spaces {
        if st.grid[i] != EMPTY {
            continue;
        }
        st.grid[i] = if rng.below(2) != 0 { VALUE_A } else { VALUE_B };
        solve(st, Tier::Tricky, None);
    }
    st.filled() && st.sound()
}

/// Port of `new_game_desc`.
pub(crate) fn generate(seed: u64, params: Params) -> Generated {
    let (w, h) = (params.width as usize, params.height as usize);
    assert!(w >= 6 && h >= 6, "width and height must be at least 6");
    assert!(w % 2 == 0 && h % 2 == 0, "width and height must both be even");
    debug_assert!(w * h <= u16::MAX as usize);
    let tier = params.tier;
    let mut rng = Rng::new(seed);

    loop {
        // A random valid full grid. Retries draw from the same stream, so
        // every attempt uses fresh derived randomness.
        let mut st = loop {
            let mut st = State::new(w, h);
            if fill_game(&mut st, &mut rng) {
                break st;
            }
        };
        let solution = st.grid.clone();

        // Blank cells one at a time, keeping the ones the technique solver
        // turns out to need.
        let mut spaces: Vec<usize> = (0..w * h).collect();
        rng.shuffle(&mut spaces);
        for i in spaces {
            let given = st.grid[i];
            st.grid[i] = EMPTY;
            let mut work = st.clone();
            if solve(&mut work, tier, None) != Outcome::Solved {
                st.grid[i] = given;
            }
        }

        // See if the game has accidentally come out too easy.
        if tier == Tier::Tricky {
            let mut work = st.clone();
            if solve(&mut work, Tier::Easy, None) != Outcome::Stuck {
                continue;
            }
        }

        let description = encode_description(&st);
        let (hints, solved) = solve_with_trace(&description, tier);
        debug_assert_eq!(solved.as_deref(), Some(solution.as_slice()));
        debug_assert!(solution.iter().all(|&v| v == VALUE_A || v == VALUE_B));
        debug_assert_eq!(crate::count_solutions(&description, 2), 1);
        let pairs = solution_pairs(&description, &solution);
        return Generated {
            description,
            solution,
            hints,
            pairs,
            tier,
        };
    }
}
