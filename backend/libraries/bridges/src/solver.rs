use crate::state::{MAX_BRIDGES, State};
use crate::{Hint, Technique, Tier};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    NoSolution,
    /// Techniques exhausted without a full, connected grid (Tatham's 0
    /// from `solve_sub` when nothing was actually wrong).
    Stuck,
}

/// Port of `solve_sub` for difficulties 0 (stage 1 only) and 1 (stages 1
/// and 2). Stage 3 (DIFF_HARD) and the recursive finish are not ported.
pub(crate) fn solve(st: &mut State, tier: Tier, mut rec: Option<&mut Vec<Hint>>) -> Outcome {
    loop {
        let mut did = false;
        for i in 0..st.islands.len() {
            match stage1(st, i, &mut rec) {
                Ok(d) => did |= d,
                Err(()) => return Outcome::NoSolution,
            }
        }
        if did {
            continue;
        }
        if tier == Tier::Easy {
            break;
        }
        for i in 0..st.islands.len() {
            if st.marked[i] {
                continue;
            }
            did |= stage2(st, i, &mut rec);
        }
        if !did {
            break;
        }
    }
    if st.solved() { Outcome::Solved } else { Outcome::Stuck }
}

/// Cells the deduction looked at: the island, then for each edge its water
/// cells and the island at the far end.
fn focus(st: &State, i: usize, edges: &[usize]) -> Vec<u16> {
    let mut out = vec![st.islands[i].cell as u16];
    for &e in edges {
        out.extend(st.edges[e].cells.iter().map(|&c| c as u16));
        out.push(st.islands[st.other_end(e, i)].cell as u16);
    }
    out
}

/// Every edge that just became final and has not been concluded before
/// gets its value recorded; one Hint per technique application that fixes
/// at least one edge. `target` is the part of `focus` the technique's
/// sentence points at, and every key it returns must also be in `focus`.
fn conclude(
    st: &mut State,
    rec: &mut Option<&mut Vec<Hint>>,
    technique: Technique,
    focus: impl FnOnce(&State) -> Vec<u16>,
    target: impl FnOnce(&State) -> Vec<u16>,
) {
    let Some(v) = rec else {
        return;
    };
    let mut conclusions = Vec::new();
    for e in 0..st.edges.len() {
        if !st.concluded[e] && st.is_final(e) {
            st.concluded[e] = true;
            conclusions.push((st.edges[e].key, st.lines[e]));
        }
    }
    if conclusions.is_empty() {
        return;
    }
    let focus = focus(st);
    let target = target(st);
    debug_assert!(!target.is_empty() && target.iter().all(|k| focus.contains(k)));
    v.push(Hint {
        technique,
        focus,
        target,
        conclusions,
    });
}

/// Port of `solve_island_stage1`: mark a full island; otherwise fill every
/// remaining space (`solve_fill`) when the island needs them all, or put
/// one bridge each way (`solve_fillone`) when it cannot skip a neighbour.
/// Err means the island has too many bridges: no solution from here.
fn stage1(st: &mut State, i: usize, rec: &mut Option<&mut Vec<Hint>>) -> Result<bool, ()> {
    let count = st.islands[i].count;
    let bridges = st.bridges(i);
    if bridges > count {
        return Err(());
    }
    if bridges == count {
        if st.marked[i] {
            return Ok(false);
        }
        // Marking finalises nothing new: the step that filled the island
        // already concluded every edge of it (see State::cap).
        st.marked[i] = true;
        return Ok(true);
    }
    if st.marked[i] {
        return Err(());
    }

    let nspaces = st.countspaces(i);
    let nadj = st.countadj(i) as i32;
    if count == bridges + nspaces {
        let missing = count - bridges;
        let mut touched = Vec::new();
        for e in st.island_edges(i) {
            let nnew = st.adjspace(e, missing);
            if nnew > 0 {
                st.lines[e] += nnew;
                touched.push(e);
            }
        }
        if touched.is_empty() {
            return Ok(false);
        }
        // "This island ...": the sentence points at the island alone.
        conclude(
            st,
            rec,
            Technique::AllSpacesNeeded,
            |st| focus(st, i, &touched),
            |st| vec![st.islands[i].cell as u16],
        );
        Ok(true)
    } else if count as i32 > (nadj - 1) * MAX_BRIDGES as i32 {
        let considered: Vec<usize> = st.island_edges(i).filter(|&e| st.isadj(e) > 0).collect();
        let mut did = false;
        for &e in &considered {
            if st.lines[e] == 0 {
                st.lines[e] = 1;
                did = true;
            }
        }
        if !did {
            return Ok(false);
        }
        // "This island's number ...": the sentence points at the island alone.
        conclude(
            st,
            rec,
            Technique::OneEachWay,
            |st| focus(st, i, &considered),
            |st| vec![st.islands[i].cell as u16],
        );
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Port of `solve_island_stage2` with loops allowed: if the other
/// directions together cannot supply the island's number, this direction
/// must carry at least one bridge.
fn stage2(st: &mut State, i: usize, rec: &mut Option<&mut Vec<Hint>>) -> bool {
    let count = st.islands[i].count as i32;
    let considered: Vec<usize> = st.island_edges(i).filter(|&e| st.isadj(e) > 0).collect();
    let navail: i32 = considered.iter().map(|&e| st.isadj(e) as i32).sum();
    let mut forced = Vec::new();
    for &e in &considered {
        if st.lines[e] == 0 && navail - (st.isadj(e) as i32) < count {
            st.lines[e] = 1;
            forced.push(e);
        }
    }
    if forced.is_empty() {
        return false;
    }
    // "this neighbour ... this island": both ends of every direction the
    // step forced a bridge into.
    conclude(
        st,
        rec,
        Technique::NeedsNeighbour,
        |st| focus(st, i, &considered),
        |st| {
            let mut out = vec![st.islands[i].cell as u16];
            out.extend(forced.iter().map(|&e| st.islands[st.other_end(e, i)].cell as u16));
            out
        },
    );
    true
}

/// True if the partial grid can no longer be completed: an island with too
/// many bridges, or one whose edges cannot supply the rest of its number.
fn contradiction(st: &State) -> bool {
    (0..st.islands.len()).any(|i| {
        let bridges = st.bridges(i);
        let room: u8 = st.island_edges(i).map(|e| st.cap(e) - st.lines[e].min(st.cap(e))).sum();
        bridges > st.islands[i].count || bridges + room < st.islands[i].count
    })
}

/// Exhaustive solution count, capped. Runs the Easy techniques, then
/// branches on the open edge with the fewest remaining values; branch v
/// fixes that edge at exactly v, so the branches partition the space.
pub(crate) fn count_solutions(st: &mut State, cap: u32) -> u32 {
    match solve(st, Tier::Easy, None) {
        Outcome::Solved => return 1,
        Outcome::NoSolution => return 0,
        Outcome::Stuck => {}
    }
    if contradiction(st) {
        return 0;
    }
    let mut best: Option<(usize, u8, u8)> = None;
    for e in 0..st.edges.len() {
        if st.is_final(e) {
            continue;
        }
        let (lo, hi) = (st.lines[e], st.cap(e));
        if best.is_none_or(|(_, blo, bhi)| hi - lo < bhi - blo) {
            best = Some((e, lo, hi));
        }
    }
    let Some((e, lo, hi)) = best else {
        return 0;
    };
    let mut total = 0;
    for v in lo..=hi {
        let mut branch = st.clone();
        branch.lines[e] = v;
        branch.max[e] = v;
        total += count_solutions(&mut branch, cap - total);
        if total >= cap {
            return cap;
        }
    }
    total
}
