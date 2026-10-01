use crate::solver::{Mark, Outcome, solve};
use crate::state::Board;
use crate::{
    Generated, LOGO, MAX_ONE_CELL_ROOMS, MAX_SIZE, MAX_WORK, MIN_SIZE, NO_LOGO, Params, Tier, encode_description,
    solution_pairs, solve_with_trace,
};
use puzzle_core::{Budget, GenerateError, Rng, neighbours};

/// Room layouts tried against one solution before drawing a new one.
const LAYOUTS_PER_SOLUTION: u32 = 4;
/// Cell moves tried on one layout before growing a fresh one.
const MOVES_PER_LAYOUT: u32 = 400;
/// Search nodes allowed for placing one random solution. Any side of at
/// least four has one, and the shuffled search finds it in a few dozen.
const MAX_PLACEMENT_NODES: u32 = 100_000;

/// Reject sizes this game has no puzzle for, before any searching.
fn validate(params: Params) -> Result<usize, GenerateError> {
    let (w, h) = (params.width as usize, params.height as usize);
    if w != h {
        return Err(GenerateError::invalid(format!("the grid must be square, got {w}x{h}")));
    }
    if !(MIN_SIZE..=MAX_SIZE).contains(&w) {
        return Err(GenerateError::invalid(format!(
            "size must be within {MIN_SIZE}..={MAX_SIZE}, got {w}"
        )));
    }
    Ok(w)
}

/// One logo per row and column with no two touching: `cols[r]` is row
/// `r`'s column. Shuffled backtracking, so every attempt draws a
/// different one.
fn place_logos(n: usize, rng: &mut Rng) -> Option<Vec<usize>> {
    fn place(n: usize, row: usize, cols: &mut Vec<usize>, used: &mut [bool], rng: &mut Rng, nodes: &mut u32) -> bool {
        if row == n {
            return true;
        }
        let mut order: Vec<usize> = (0..n).collect();
        rng.shuffle(&mut order);
        for c in order {
            if *nodes == 0 {
                return false;
            }
            *nodes -= 1;
            if used[c] || cols.last().is_some_and(|&p| p.abs_diff(c) < 2) {
                continue;
            }
            used[c] = true;
            cols.push(c);
            if place(n, row + 1, cols, used, rng, nodes) {
                return true;
            }
            cols.pop();
            used[c] = false;
        }
        false
    }
    let mut cols = Vec::with_capacity(n);
    let mut nodes = MAX_PLACEMENT_NODES;
    place(n, 0, &mut cols, &mut vec![false; n], rng, &mut nodes).then_some(cols)
}

const UNCLAIMED: u8 = u8::MAX;

/// Grow one room outwards from each logo: repeatedly hand a random
/// unclaimed cell next to a room to one of the rooms it touches. Every
/// room stays connected, since it only ever takes a cell beside itself.
/// Room `r` is the one holding row `r`'s logo. Each room first takes one
/// cell beside its logo, so a layout starts with no one-cell rooms unless
/// a logo is boxed in.
fn grow_rooms(n: usize, cols: &[usize], rng: &mut Rng) -> Vec<u8> {
    let mut rooms = vec![UNCLAIMED; n * n];
    for (r, &c) in cols.iter().enumerate() {
        rooms[r * n + c] = r as u8;
    }
    let mut order: Vec<usize> = (0..n).collect();
    rng.shuffle(&mut order);
    for r in order {
        let free: Vec<usize> = neighbours(n, n, r * n + cols[r]).filter(|&j| rooms[j] == UNCLAIMED).collect();
        if !free.is_empty() {
            rooms[free[rng.below(free.len())]] = r as u8;
        }
    }
    loop {
        let frontier: Vec<usize> = (0..n * n)
            .filter(|&i| rooms[i] == UNCLAIMED && neighbours(n, n, i).any(|j| rooms[j] != UNCLAIMED))
            .collect();
        if frontier.is_empty() {
            return rooms;
        }
        let cell = frontier[rng.below(frontier.len())];
        let touching: Vec<u8> = neighbours(n, n, cell).map(|j| rooms[j]).filter(|&r| r != UNCLAIMED).collect();
        rooms[cell] = touching[rng.below(touching.len())];
    }
}

/// How many rooms are a single cell.
fn one_cell_rooms(n: usize, rooms: &[u8]) -> usize {
    let mut sizes = vec![0usize; n];
    for &r in rooms {
        sizes[r as usize] += 1;
    }
    sizes.iter().filter(|&&s| s == 1).count()
}

/// Whether room `room` is still one connected piece without cell `gone`.
fn connected_without(n: usize, rooms: &[u8], room: u8, gone: usize) -> bool {
    let cells: Vec<usize> = (0..n * n).filter(|&i| i != gone && rooms[i] == room).collect();
    let Some(&first) = cells.first() else {
        return false;
    };
    let mut seen = vec![false; n * n];
    let mut stack = vec![first];
    seen[first] = true;
    let mut reached = 1;
    while let Some(i) = stack.pop() {
        for j in neighbours(n, n, i) {
            if j != gone && !seen[j] && rooms[j] == room {
                seen[j] = true;
                reached += 1;
                stack.push(j);
            }
        }
    }
    reached == cells.len()
}

/// How far the solver gets on this layout: the number of cells it decides.
fn progress(n: usize, rooms: &[u8], tier: Tier) -> usize {
    let (outcome, marks) = solve(&Board::from_rooms(n, rooms.to_vec()), tier, None);
    if outcome == Outcome::Solved { n * n } else { marks.iter().filter(|&&m| m != Mark::Open).count() }
}

/// Hill-climb the layout towards one the solver finishes: move a random
/// cell on a room's edge into the room beside it, and keep the move when
/// the solver gets at least as far as before. Logo cells never move, so
/// the planted solution stays a solution, and a move that would split
/// the room it leaves is skipped, as is one that would leave it a single
/// cell when the board already has [`MAX_ONE_CELL_ROOMS`] of those.
/// `false` when this layout runs out of moves first.
fn climb(
    n: usize,
    rooms: &mut [u8],
    logos: &[bool],
    tier: Tier,
    rng: &mut Rng,
    budget: &mut Budget,
) -> Result<bool, GenerateError> {
    let mut score = progress(n, rooms, tier);
    for _ in 0..MOVES_PER_LAYOUT {
        if score == n * n {
            return Ok(true);
        }
        let cell = rng.below(n * n);
        if logos[cell] {
            continue;
        }
        let beside: Vec<u8> = neighbours(n, n, cell)
            .map(|j| rooms[j])
            .filter(|&r| r != rooms[cell])
            .collect();
        if beside.is_empty() {
            continue;
        }
        let from = rooms[cell];
        if !connected_without(n, rooms, from, cell) {
            continue;
        }
        let from_size = rooms.iter().filter(|&&r| r == from).count();
        if from_size == 2 && one_cell_rooms(n, rooms) >= MAX_ONE_CELL_ROOMS {
            continue;
        }
        budget.spend()?;
        rooms[cell] = beside[rng.below(beside.len())];
        let moved = progress(n, rooms, tier);
        if moved >= score {
            score = moved;
        } else {
            rooms[cell] = from;
        }
    }
    Ok(score == n * n)
}

/// Ids renumbered in reading order, so an id says nothing about which row
/// its logo is in.
fn renumber(rooms: &[u8]) -> Vec<u8> {
    let mut to = vec![UNCLAIMED; rooms.len()];
    let mut next = 0;
    rooms
        .iter()
        .map(|&r| {
            if to[r as usize] == UNCLAIMED {
                to[r as usize] = next;
                next += 1;
            }
            to[r as usize]
        })
        .collect()
}

pub(crate) fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    generate_within(seed, params, MAX_WORK)
}

/// [`generate`] with the work budget as a parameter, so a test can prove the budget is what stops
/// it: every size the game accepts succeeds well inside `MAX_WORK`, so nothing else reaches the
/// exhausted path.
fn generate_within(seed: u64, params: Params, max_work: u32) -> Result<Generated, GenerateError> {
    let n = validate(params)?;
    let tier = params.tier;
    let mut rng = Rng::new(seed);
    let mut budget = Budget::new(max_work);

    loop {
        budget.spend()?;
        let Some(cols) = place_logos(n, &mut rng) else {
            continue;
        };
        let mut solution = vec![NO_LOGO; n * n];
        for (r, &c) in cols.iter().enumerate() {
            solution[r * n + c] = LOGO;
        }

        let logos: Vec<bool> = solution.iter().map(|&v| v == LOGO).collect();

        for _ in 0..LAYOUTS_PER_SOLUTION {
            budget.spend()?;
            let mut rooms = grow_rooms(n, &cols, &mut rng);
            if !climb(n, &mut rooms, &logos, tier, &mut rng, &mut budget)? || one_cell_rooms(n, &rooms) > MAX_ONE_CELL_ROOMS {
                continue;
            }
            let board = Board::from_rooms(n, renumber(&rooms));
            // A Tricky puzzle is one the Easy techniques cannot finish
            if tier == Tier::Tricky {
                budget.spend()?;
                if solve(&board, Tier::Easy, None).0 == Outcome::Solved {
                    continue;
                }
            }

            let description = encode_description(n, &board.rooms);
            // Checked at runtime, not with debug_assert: these are compiled
            // out of the wasm build, and a puzzle whose hints lead somewhere
            // other than its stored solution must never reach a player.
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
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Invariant 3, the budget half: generation stops when its work budget runs out, with an
    /// error the canister can act on, rather than running on until the message traps
    #[test]
    fn generation_stops_when_the_budget_runs_out() {
        for tier in Tier::ALL {
            for max_work in [0, 1, 5] {
                assert!(matches!(
                    generate_within(1, Params::default_for(9, 9, tier), max_work),
                    Err(GenerateError::Exhausted { .. })
                ));
            }
        }
    }
}
