use crate::state::Board;
use crate::{Hint, LOGO, NO_LOGO, Technique, Tier};
use puzzle_core::{MAX_SEARCH_DEPTH, SearchBudget};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Mark {
    Open,
    Logo,
    No,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    /// A rule is already broken, so nothing can be salvaged.
    Invalid,
    /// Techniques exhausted with logos still to place.
    Stuck,
}

/// The largest set of rooms (or lines) the Tricky solver looks at at
/// once. A pigeonhole over more than three is not something a player
/// spots, and the search for one grows with the number of subsets.
const MAX_PIGEONHOLE: usize = 3;

struct Step {
    technique: Technique,
    focus: Vec<usize>,
    target: Vec<usize>,
    conclusions: Vec<(usize, Mark)>,
}

pub(crate) fn solution_bytes(marks: &[Mark]) -> Vec<u8> {
    marks.iter().map(|&m| if m == Mark::Logo { LOGO } else { NO_LOGO }).collect()
}

/// Run the techniques from a bare board, cheapest first, one step at a
/// time, going back to the cheapest after every step.
pub(crate) fn solve(board: &Board, tier: Tier, mut rec: Option<&mut Vec<Hint>>) -> (Outcome, Vec<Mark>) {
    let n = board.n;
    let mut marks = vec![Mark::Open; n * n];
    loop {
        if broken(board, &marks) {
            return (Outcome::Invalid, marks);
        }
        if marks.iter().filter(|&&m| m == Mark::Logo).count() == n {
            return (Outcome::Solved, marks);
        }
        let step = shadow(board, &marks)
            .or_else(|| last_cell(board, &marks))
            .or_else(|| confined(board, &marks, 1))
            .or_else(|| {
                if tier == Tier::Tricky {
                    (2..=MAX_PIGEONHOLE)
                        .find_map(|k| confined(board, &marks, k))
                        .or_else(|| blocked(board, &marks))
                } else {
                    None
                }
            });
        let Some(step) = step else {
            return (Outcome::Stuck, marks);
        };
        for &(i, m) in &step.conclusions {
            marks[i] = m;
        }
        if let Some(rec) = rec.as_mut() {
            rec.push(to_hint(step));
        }
    }
}

fn to_hint(step: Step) -> Hint {
    let keys = |cells: Vec<usize>| {
        let mut out: Vec<u16> = cells.into_iter().map(|i| i as u16).collect();
        out.sort_unstable();
        out.dedup();
        out
    };
    let mut conclusions: Vec<(u16, u8)> = step
        .conclusions
        .into_iter()
        .map(|(i, m)| (i as u16, if m == Mark::Logo { LOGO } else { NO_LOGO }))
        .collect();
    conclusions.sort_unstable();
    Hint {
        technique: step.technique,
        focus: keys(step.focus),
        target: keys(step.target),
        conclusions,
    }
}

fn open_cells<'a>(board: &'a Board, marks: &'a [Mark], g: usize) -> impl Iterator<Item = usize> + 'a {
    board.groups[g].iter().copied().filter(|&i| marks[i] == Mark::Open)
}

fn has_logo(board: &Board, marks: &[Mark], g: usize) -> bool {
    board.groups[g].iter().any(|&i| marks[i] == Mark::Logo)
}

/// Two logos in one group, two logos touching, or a group with no logo
/// and nowhere left to put one.
fn broken(board: &Board, marks: &[Mark]) -> bool {
    for g in 0..board.groups.len() {
        let logos = board.groups[g].iter().filter(|&&i| marks[i] == Mark::Logo).count();
        if logos > 1 || (logos == 0 && open_cells(board, marks, g).next().is_none()) {
            return true;
        }
    }
    (0..marks.len()).any(|a| marks[a] == Mark::Logo && board.touching_after(a).any(|b| marks[b] == Mark::Logo))
}

/// A logo rules out every cell in its shadow.
fn shadow(board: &Board, marks: &[Mark]) -> Option<Step> {
    (0..marks.len()).filter(|&i| marks[i] == Mark::Logo).find_map(|i| {
        let ruled_out: Vec<usize> = board.shadows[i].iter().copied().filter(|&j| marks[j] == Mark::Open).collect();
        (!ruled_out.is_empty()).then(|| Step {
            technique: Technique::Shadow,
            focus: [vec![i], ruled_out.clone()].concat(),
            target: vec![i],
            conclusions: ruled_out.into_iter().map(|j| (j, Mark::No)).collect(),
        })
    })
}

/// A row, column or room with one open cell left takes its logo there.
fn last_cell(board: &Board, marks: &[Mark]) -> Option<Step> {
    (0..board.groups.len()).find_map(|g| {
        if has_logo(board, marks, g) {
            return None;
        }
        let mut open = open_cells(board, marks, g);
        let (Some(cell), None) = (open.next(), open.next()) else {
            return None;
        };
        let cells = &board.groups[g];
        let others: Vec<usize> = cells.iter().copied().filter(|&i| i != cell).collect();
        Some(Step {
            technique: Technique::LastCell,
            focus: cells.clone(),
            // A one-cell room has nothing else to point at, so the step
            // points at the cell and the engine withholds it below level 3.
            target: if others.is_empty() { vec![cell] } else { others },
            conclusions: vec![(cell, Mark::Logo)],
        })
    })
}

/// `k` groups of one kind whose open cells all fall in `k` groups of
/// another kind own those groups' logos, so every other open cell in them
/// is ruled out. Rooms against rows, rooms against columns, and both of
/// those the other way round. `k == 1` is [`Technique::Confined`].
fn confined(board: &Board, marks: &[Mark], k: usize) -> Option<Step> {
    let n = board.n;
    // Kinds index `Board::groups_of`: 0 rows, 1 columns, 2 rooms
    for (kind, other_kind) in [(2, 0), (2, 1), (0, 2), (1, 2)] {
        let (first, other) = (kind * n, other_kind * n);
        // Each candidate: a group of the first kind with no logo, and the
        // set of groups of the other kind its open cells fall in.
        let candidates: Vec<(usize, u32)> = (first..first + n)
            .filter(|&g| !has_logo(board, marks, g))
            .map(|g| {
                let mask = open_cells(board, marks, g).fold(0u32, |m, i| m | 1 << (board.groups_of(i)[other_kind] - other));
                (g, mask)
            })
            .filter(|&(_, mask)| mask != 0)
            .collect();
        let mut chosen = Vec::with_capacity(k);
        if let Some(step) = subsets(&candidates, k, 0, 0, &mut chosen, &mut |set, mask| {
            let owned: Vec<usize> = (0..n).filter(|b| mask & (1 << b) != 0).map(|b| other + b).collect();
            let inside = |i: usize| set.iter().any(|&g| board.groups[g].contains(&i));
            let ruled_out: Vec<usize> = owned
                .iter()
                .flat_map(|&l| open_cells(board, marks, l))
                .filter(|&i| !inside(i))
                .collect();
            if ruled_out.is_empty() {
                return None;
            }
            let target: Vec<usize> = set.iter().flat_map(|&g| open_cells(board, marks, g)).collect();
            Some(Step {
                technique: if k == 1 { Technique::Confined } else { Technique::Pigeonhole },
                focus: [target.clone(), ruled_out.clone()].concat(),
                target,
                conclusions: ruled_out.into_iter().map(|i| (i, Mark::No)).collect(),
            })
        }) {
            return Some(step);
        }
    }
    None
}

/// Every `k`-subset of `candidates` whose masks together cover exactly
/// `k` bits, in lexicographic order, until `found` returns a step.
fn subsets(
    candidates: &[(usize, u32)],
    k: usize,
    start: usize,
    mask: u32,
    chosen: &mut Vec<usize>,
    found: &mut dyn FnMut(&[usize], u32) -> Option<Step>,
) -> Option<Step> {
    if mask.count_ones() as usize > k {
        return None;
    }
    if chosen.len() == k {
        return if mask.count_ones() as usize == k { found(chosen, mask) } else { None };
    }
    for c in start..candidates.len() {
        let (g, m) = candidates[c];
        chosen.push(g);
        let step = subsets(candidates, k, c + 1, mask | m, chosen, found);
        chosen.pop();
        if step.is_some() {
            return step;
        }
    }
    None
}

/// A logo here would leave some other row, column or room with nowhere
/// to put its own.
fn blocked(board: &Board, marks: &[Mark]) -> Option<Step> {
    (0..marks.len()).filter(|&c| marks[c] == Mark::Open).find_map(|c| {
        let own = board.groups_of(c);
        (0..board.groups.len())
            .filter(|g| !own.contains(g) && !has_logo(board, marks, *g))
            .find_map(|g| {
                let open: Vec<usize> = open_cells(board, marks, g).collect();
                let emptied = !open.is_empty() && open.iter().all(|o| board.shadows[c].binary_search(o).is_ok());
                emptied.then(|| Step {
                    technique: Technique::Blocked,
                    focus: [open.clone(), vec![c]].concat(),
                    target: open,
                    conclusions: vec![(c, Mark::No)],
                })
            })
    })
}

/// Number of solutions, capped at `cap`. Branches on the row, column or
/// room with the fewest open cells, placing a logo in each and ruling out
/// its shadow.
pub(crate) fn count_solutions(board: &Board, cap: u32, budget: &mut SearchBudget) -> u32 {
    let mut marks = vec![Mark::Open; board.n * board.n];
    count_rec(board, &mut marks, 0, cap, 0, budget)
}

/// `budget` bounds the nodes as `depth` bounds one branch. Both stop by
/// claiming the cap, which reads as "more than one solution".
fn count_rec(board: &Board, marks: &mut [Mark], placed: usize, cap: u32, depth: u32, budget: &mut SearchBudget) -> u32 {
    if cap == 0 {
        return 0;
    }
    if depth >= MAX_SEARCH_DEPTH || !budget.take() {
        return cap;
    }
    if placed == board.n {
        return 1;
    }
    let mut best: Option<Vec<usize>> = None;
    for g in 0..board.groups.len() {
        if has_logo(board, marks, g) {
            continue;
        }
        let open: Vec<usize> = open_cells(board, marks, g).collect();
        if open.is_empty() {
            return 0;
        }
        if best.as_ref().is_none_or(|b| open.len() < b.len()) {
            best = Some(open);
        }
    }
    let Some(branch) = best else {
        return 0;
    };
    let mut total = 0;
    for c in branch {
        let mut next = marks.to_vec();
        next[c] = Mark::Logo;
        for &j in &board.shadows[c] {
            next[j] = Mark::No;
        }
        total += count_rec(board, &mut next, placed + 1, cap - total, depth + 1, budget);
        if total >= cap {
            return cap;
        }
    }
    total
}
