use crate::state::State;
use crate::{Hint, Technique, Tier};
use puzzle_core::{MAX_SEARCH_DEPTH, SearchBudget};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    NoSolution,
    /// Techniques exhausted with candidate cells remaining (Tatham's -1).
    Stuck,
}

fn record(rec: &mut Option<&mut Vec<Hint>>, hint: impl FnOnce() -> Hint) {
    if let Some(v) = rec {
        v.push(hint());
    }
}

/// Port of `solve_sub` without the recursive branch: run the basic
/// techniques to a fixed point, then (Tricky only) one set-exclusion step,
/// and repeat until solved, contradicted or stuck.
pub(crate) fn solve(st: &mut State, tier: Tier, mut rec: Option<&mut Vec<Hint>>) -> Outcome {
    for used in st.clue_used.iter_mut() {
        *used = false;
    }
    let (w, h) = (st.w, st.h);
    loop {
        if st.grid_overlap() {
            return Outcome::NoSolution;
        }
        if st.grid_correct() {
            return Outcome::Solved;
        }

        let mut can_place = 0;
        let mut did = false;
        for x in 0..w {
            for y in 0..h {
                let i = y * w + x;
                if st.could_place(i) {
                    can_place += 1;
                }
                if try_solve_light(st, i, &mut rec) {
                    did = true;
                }
                if try_solve_number(st, i, &mut rec) {
                    did = true;
                }
            }
        }
        if did {
            continue;
        }
        if can_place == 0 {
            return Outcome::NoSolution;
        }

        if tier == Tier::Tricky {
            'sets: for x in 0..w {
                for y in 0..h {
                    let i = y * w + x;
                    let found = if !st.black[i] && st.lit[i] == 0 {
                        discount_unlit(st, i, &mut rec)
                    } else if st.clue[i].is_some() {
                        discount_clue(st, i, &mut rec)
                    } else {
                        false
                    };
                    if found {
                        did = true;
                        break 'sets;
                    }
                }
            }
        }
        if !did {
            return Outcome::Stuck;
        }
    }
}

/// Port of `try_solve_light`: an unlit cell with exactly one place a bulb
/// could go to light it.
fn try_solve_light(st: &mut State, i: usize, rec: &mut Option<&mut Vec<Hint>>) -> bool {
    if st.black[i] || st.lit[i] > 0 {
        return false;
    }
    let los = st.los(i, true);
    let mut candidate = None;
    let mut n = 0;
    for c in los.cells() {
        if !st.impossible[c] && st.lit[c] == 0 {
            candidate = Some(c);
            n += 1;
        }
    }
    let Some(c) = candidate.filter(|_| n == 1) else {
        return false;
    };
    st.set_light(c, true);
    record(rec, || {
        let mut focus = vec![i as u16];
        focus.extend(los.cells().filter(|&x| x != i).map(|x| x as u16));
        Hint {
            technique: Technique::OnlyOneWayToLight,
            target: vec![i as u16],
            focus,
            conclusions: vec![(c as u16, 1)],
        }
    });
    true
}

/// Port of `try_solve_number`: a clue that is already satisfied rules out
/// its remaining neighbours; a clue with exactly as many free neighbours as
/// bulbs still needed forces them all.
fn try_solve_number(st: &mut State, i: usize, rec: &mut Option<&mut Vec<Hint>>) -> bool {
    let Some(clue) = st.clue[i] else {
        return false;
    };
    let mut needed = clue as i32;
    let mut free = Vec::with_capacity(4);
    for nb in st.neighbours(i) {
        if st.light[nb] {
            needed -= 1;
        } else if st.could_place(nb) {
            free.push(nb);
        }
    }
    if free.is_empty() {
        return false;
    }
    let mut focus = vec![i as u16];
    focus.extend(st.neighbours(i).map(|n| n as u16));
    if needed == 0 {
        st.clue_used[i] = true;
        for &c in &free {
            st.impossible[c] = true;
        }
        record(rec, || Hint {
            technique: Technique::ClueSatisfied,
            target: vec![i as u16],
            focus,
            conclusions: free.iter().map(|&c| (c as u16, 0)).collect(),
        });
        true
    } else if needed == free.len() as i32 {
        st.clue_used[i] = true;
        for &c in &free {
            st.set_light(c, true);
        }
        record(rec, || Hint {
            technique: Technique::ClueForced,
            target: vec![i as u16],
            focus,
            conclusions: free.iter().map(|&c| (c as u16, 1)).collect(),
        });
        true
    } else {
        false
    }
}

/// Port of `try_rule_out`: every free cell where a bulb would rule out a
/// bulb at `i` — anything in its line of sight, plus the other free
/// neighbours of any adjacent clue that a bulb at `i` would complete.
fn rule_out_squares(st: &State, i: usize, out: &mut Vec<usize>) {
    out.clear();
    out.extend(st.los(i, false).cells().filter(|&c| st.could_place(c)));
    for nb in st.neighbours(i) {
        let Some(total) = st.clue[nb] else {
            continue;
        };
        if st.lit_neighbours(nb) + 1 == total {
            out.extend(st.neighbours(nb).filter(|&c| c != i && st.could_place(c)));
        }
    }
}

/// Port of `discount_set`. `set` is a MAKESLIGHT set: at least one of its
/// cells must hold a bulb. Any free cell whose bulb would rule out every
/// member of the set is therefore impossible.
fn discount_set(st: &mut State, set: &[usize], rec: &mut Option<&mut Vec<Hint>>) -> bool {
    if set.is_empty() {
        return false;
    }
    let mut scratch = Vec::new();
    let mut best = set[0];
    let mut best_n = usize::MAX;
    for &s in set {
        rule_out_squares(st, s, &mut scratch);
        if scratch.len() < best_n {
            best_n = scratch.len();
            best = s;
        }
    }
    let mut candidates = Vec::new();
    rule_out_squares(st, best, &mut candidates);
    let mut did = false;
    for d in candidates {
        if st.impossible[d] {
            continue;
        }
        rule_out_squares(st, d, &mut scratch);
        if !set.iter().all(|s| scratch.contains(s)) {
            continue;
        }
        st.impossible[d] = true;
        record(rec, || {
            let mut focus: Vec<u16> = set.iter().map(|&s| s as u16).collect();
            focus.push(d as u16);
            Hint {
                technique: Technique::SetExclusion,
                target: vec![d as u16],
                focus,
                conclusions: vec![(d as u16, 0)],
            }
        });
        did = true;
    }
    did
}

/// Port of `discount_unlit`: the cells that could light an unlit cell form
/// a MAKESLIGHT set.
fn discount_unlit(st: &mut State, i: usize, rec: &mut Option<&mut Vec<Hint>>) -> bool {
    let set: Vec<usize> = st.los(i, true).cells().filter(|&c| st.could_place(c)).collect();
    discount_set(st, &set, rec)
}

/// Port of `discount_clue`: for a clue with `n` free neighbours still
/// needing `m` bulbs, every subset of size n-m+1 is a MAKESLIGHT set.
fn discount_clue(st: &mut State, i: usize, rec: &mut Option<&mut Vec<Hint>>) -> bool {
    let Some(clue) = st.clue[i] else {
        return false;
    };
    if clue == 0 {
        return false;
    }
    let m = clue as i32 - st.lit_neighbours(i) as i32;
    let free: Vec<usize> = st.neighbours(i).filter(|&c| st.could_place(c)).collect();
    let n = free.len() as i32;
    if n == 0 || m <= 0 || m > n {
        return false;
    }
    let mut did = false;
    for combo in combinations(free.len(), (n - m + 1) as usize) {
        let set: Vec<usize> = combo.iter().map(|&k| free[k]).collect();
        if discount_set(st, &set, rec) {
            did = true;
        }
    }
    did
}

/// All r-subsets of 0..n in lexicographic order (Tatham's combi.c).
fn combinations(n: usize, r: usize) -> Vec<Vec<usize>> {
    let mut out = Vec::new();
    let mut current = Vec::with_capacity(r);
    fn go(start: usize, n: usize, r: usize, current: &mut Vec<usize>, out: &mut Vec<Vec<usize>>) {
        if current.len() == r {
            out.push(current.clone());
            return;
        }
        for k in start..n {
            current.push(k);
            go(k + 1, n, r, current, out);
            current.pop();
        }
    }
    go(0, n, r, &mut current, &mut out);
    out
}

/// True if the partial grid can no longer be completed: a clue with too
/// many bulbs or too few places left, or an unlit cell nothing can light.
fn contradiction(st: &State) -> bool {
    for i in 0..st.size() {
        if let Some(clue) = st.clue[i] {
            let lit = st.lit_neighbours(i);
            let free = st.neighbours(i).filter(|&c| st.could_place(c)).count() as u8;
            if lit > clue || lit + free < clue {
                return true;
            }
        } else if !st.black[i] && st.lit[i] == 0 && !st.los(i, true).cells().any(|c| st.could_place(c)) {
            return true;
        }
    }
    false
}

/// Exhaustive solution count, capped. Branches on the unlit cell with the
/// fewest candidates; branch k places a bulb at candidate k and forbids
/// candidates 0..k, so the branches partition the solution space.
///
/// `budget` bounds the nodes as `depth` bounds one branch: the depth cap
/// alone leaves a description from outside free to explore a tree that is
/// wide rather than deep. Both stop by claiming the cap, which reads as
/// "more than one solution".
pub(crate) fn count_solutions(st: &mut State, cap: u32, depth: u32, budget: &mut SearchBudget) -> u32 {
    if depth >= MAX_SEARCH_DEPTH || !budget.take() {
        return cap;
    }
    match solve(st, Tier::Easy, None) {
        Outcome::Solved => return 1,
        Outcome::NoSolution => return 0,
        Outcome::Stuck => {}
    }
    if contradiction(st) {
        return 0;
    }
    let mut best: Option<Vec<usize>> = None;
    for i in 0..st.size() {
        if st.black[i] || st.lit[i] > 0 {
            continue;
        }
        let cands: Vec<usize> = st.los(i, true).cells().filter(|&c| st.could_place(c)).collect();
        if best.as_ref().is_none_or(|b| cands.len() < b.len()) {
            best = Some(cands);
        }
    }
    let Some(cands) = best else {
        return 0;
    };
    let mut total = 0;
    for (k, &c) in cands.iter().enumerate() {
        let mut branch = st.clone();
        for &p in &cands[..k] {
            branch.impossible[p] = true;
        }
        branch.set_light(c, true);
        total += count_solutions(&mut branch, cap - total, depth + 1, budget);
        if total >= cap {
            return cap;
        }
    }
    total
}
