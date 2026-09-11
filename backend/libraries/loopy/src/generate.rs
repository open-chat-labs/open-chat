use crate::grid::Grid;
use crate::solver::{Outcome, solve};
use crate::state::State;
use crate::{Generated, MAX_WORK, Params, Tier, encode_description, solution_pairs, solve_with_trace};
use puzzle_core::{Budget, GenerateError, Rng, side_ok, side_too_big};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Colour {
    White,
    Grey,
    Black,
}

/// The outside of the grid is the infinite black face.
fn colour_at(board: &[Colour], f: Option<usize>) -> Colour {
    f.map_or(Colour::Black, |i| board[i])
}

/// Port of `can_colour_face`: the cell must touch a cell of this colour
/// along an edge, and walking round its eight neighbours must cross the
/// colour boundary exactly twice, so neither colour forms a loop or
/// meets itself at a corner.
fn can_colour(grid: Grid, board: &[Colour], f: usize, colour: Colour) -> bool {
    debug_assert!(board[f] != colour);
    if !grid.cell_neighbours(f).into_iter().any(|n| colour_at(board, n) == colour) {
        return false;
    }
    let ring = grid.cell_ring(f);
    let mut prev = colour_at(board, ring[7]) == colour;
    let mut transitions = 0;
    for n in ring {
        let same = colour_at(board, n) == colour;
        if same != prev {
            transitions += 1;
            prev = same;
        }
    }
    transitions == 2
}

/// Port of `face_num_neighbours`.
fn same_neighbours(grid: Grid, board: &[Colour], f: usize, colour: Colour) -> usize {
    grid.cell_neighbours(f)
        .into_iter()
        .filter(|&n| colour_at(board, n) == colour)
        .count()
}

/// The grey cell Tatham's sorted candidate list would put first for this
/// colour: fewest same-coloured neighbours (most loopiness), then the
/// smallest fixed random key, then the lowest index.
fn pick(grid: Grid, board: &[Colour], random: &[u32], colour: Colour) -> Option<usize> {
    let mut best: Option<(usize, u32, usize)> = None;
    for f in 0..grid.cells() {
        if board[f] != Colour::Grey || !can_colour(grid, board, f, colour) {
            continue;
        }
        let key = (same_neighbours(grid, board, f, colour), random[f], f);
        if best.is_none_or(|b| key < b) {
            best = Some(key);
        }
    }
    best.map(|(_, _, f)| f)
}

/// Port of `generate_loop` for the square grid: grow a white region and
/// a black region from grey until the grid is full, keeping each region
/// simply connected, then flip cells to grow tendrils into any clumps and
/// finish with a pass of random flips.
///
/// `None` when the colouring stalled with grey cells left. Tatham asserts
/// that cannot happen; the loop below exits on exactly that condition, so
/// here it is a retry signal the budgeted caller consumes. Asserting
/// would abort the process in a debug build and, with the assert compiled
/// out, leave `add_full_clues` reading a grey boundary as a line and
/// clueing a loop that does not exist.
fn generate_loop(grid: Grid, rng: &mut Rng) -> Option<Vec<Colour>> {
    let n = grid.cells();
    let mut board = vec![Colour::Grey; n];
    let random: Vec<u32> = (0..n).map(|_| (rng.next_u64() >> 33) as u32).collect();
    board[rng.below(n)] = Colour::White;

    loop {
        let light = pick(grid, &board, &random, Colour::White);
        let dark = pick(grid, &board, &random, Colour::Black);
        if light.is_none() && dark.is_none() {
            break;
        }
        // The draw comes after that break, as Tatham's does, so the RNG
        // stream is unchanged. Tatham then asserts that both colours have
        // a candidate and takes the one drawn. Here the drawn colour is
        // taken when it has a candidate and the other colour otherwise:
        // the line above already contemplates a list being empty, and a
        // failed assertion in a canister is a trap.
        let wants_white = rng.below(2) == 1;
        let (colour, chosen) = match (wants_white, light, dark) {
            (true, Some(f), _) => (Colour::White, f),
            (false, _, Some(f)) => (Colour::Black, f),
            (true, None, Some(f)) => (Colour::Black, f),
            (false, Some(f), None) => (Colour::White, f),
            // Unreachable after the check above, and a break rather than
            // a panic so that it stays unreachable if that ever changes.
            (_, None, None) => break,
        };
        board[chosen] = colour;
    }
    if board.contains(&Colour::Grey) {
        return None;
    }

    let mut order: Vec<usize> = (0..n).collect();
    rng.shuffle(&mut order);
    let mut random_pass = false;
    loop {
        let mut flipped = false;
        for &f in &order {
            let opp = if board[f] == Colour::White { Colour::Black } else { Colour::White };
            if !can_colour(grid, &board, f, opp) {
                continue;
            }
            if random_pass {
                if rng.below(10) == 0 {
                    board[f] = opp;
                }
            } else if same_neighbours(grid, &board, f, opp) == 1 {
                board[f] = opp;
                flipped = true;
            }
        }
        if random_pass {
            break;
        }
        if !flipped {
            random_pass = true;
        }
    }
    Some(board)
}

/// Port of `add_full_clues`: a random loop, every cell clued. Returns the
/// clued state and the loop as solution bytes, or `None` if the loop
/// could not be drawn.
fn add_full_clues(grid: Grid, rng: &mut Rng) -> Option<(State, Vec<u8>)> {
    let board = generate_loop(grid, rng)?;
    let mut clues = vec![0u8; grid.cells()];
    let mut solution = vec![0u8; grid.edges()];
    for (e, byte) in solution.iter_mut().enumerate() {
        let [a, b] = grid.edge_cells(e);
        if colour_at(&board, a) != colour_at(&board, b) {
            *byte = 1;
            for f in [a, b].into_iter().flatten() {
                clues[f] += 1;
            }
        }
    }
    Some((State::new(grid, clues.into_iter().map(Some).collect()), solution))
}

/// Port of `game_has_unique_soln`: the technique solver at this tier must
/// finish from the empty grid. Every technique is sound, so finishing
/// also proves uniqueness.
///
/// Charged to the budget, because `remove_clues` runs one of these per
/// cell and that, not the attempt count, is where a generate call spends
/// its instructions.
fn has_unique_soln(st: &State, tier: Tier, budget: &mut Budget) -> Result<bool, GenerateError> {
    budget.spend()?;
    let mut work = st.clone();
    Ok(solve(&mut work, tier, None) == Outcome::Solved)
}

/// Port of `remove_clues`: drop clues in random order while the solver
/// still finishes.
fn remove_clues(st: &mut State, rng: &mut Rng, tier: Tier, budget: &mut Budget) -> Result<(), GenerateError> {
    let mut order: Vec<usize> = (0..st.grid.cells()).collect();
    rng.shuffle(&mut order);
    for f in order {
        let saved = st.clues[f];
        st.clues[f] = None;
        if !has_unique_soln(st, tier, budget)? {
            st.clues[f] = saved;
        }
    }
    Ok(())
}

/// Reject sizes this game has no puzzle for, before any searching.
fn validate(params: Params) -> Result<Grid, GenerateError> {
    let grid = Grid {
        w: params.width as usize,
        h: params.height as usize,
    };
    if grid.w < 3 || grid.h < 3 {
        return Err(GenerateError::invalid(format!(
            "width and height must be at least 3, got {}x{}",
            grid.w, grid.h
        )));
    }
    if !side_ok(grid.w, grid.h) {
        return Err(GenerateError::invalid(side_too_big(grid.w, grid.h)));
    }
    Ok(grid)
}

/// Port of `new_game_desc`. Both of Tatham's loops retry without bound;
/// here they share one budget, so parameters with no puzzle end in a
/// `GenerateError` instead of spinning until the canister traps.
pub(crate) fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    let grid = validate(params)?;
    let tier = params.tier;
    let mut rng = Rng::new(seed);
    let mut budget = Budget::new(MAX_WORK);

    loop {
        budget.spend()?;
        let (mut st, solution) = loop {
            budget.spend()?;
            let Some((st, solution)) = add_full_clues(grid, &mut rng) else {
                continue;
            };
            if has_unique_soln(&st, tier, &mut budget)? {
                break (st, solution);
            }
        };
        remove_clues(&mut st, &mut rng, tier, &mut budget)?;
        if tier == Tier::Tricky && has_unique_soln(&st, Tier::Easy, &mut budget)? {
            continue;
        }
        let description = encode_description(&st);
        // Checked at runtime, not with debug_assert: a puzzle whose hints
        // lead somewhere other than its stored solution, or which needs no
        // deductions at all, must never reach a player.
        let Ok((hints, solved)) = solve_with_trace(&description, tier) else {
            continue;
        };
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
