use crate::state::{MAX_BRIDGES, State};
use crate::{Hint, Technique, Tier};
use puzzle_core::{MAX_SEARCH_DEPTH, SearchBudget};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    NoSolution,
    /// Techniques exhausted without a full, connected grid (Tatham's 0
    /// from `solve_sub` when nothing was actually wrong).
    Stuck,
}

/// What a traced solve accumulates: the hints, and which edges have
/// already appeared in a conclusion so no edge is concluded twice.
///
/// The second of those used to live on `State`, where an untraced solve
/// left it untouched: the same puzzle finished with a different `State`
/// depending on whether anyone was watching. It is trace bookkeeping, not
/// solver state, so it belongs here.
#[derive(Debug, Default)]
pub(crate) struct Recorder {
    pub hints: Vec<Hint>,
    concluded: Vec<bool>,
}

impl Recorder {
    pub fn new(edges: usize) -> Self {
        Recorder {
            hints: Vec::new(),
            concluded: vec![false; edges],
        }
    }
}

/// Port of `solve_sub` for difficulties 0 (stage 1 only) and 1 (stages 1
/// and 2). Stage 3 (DIFF_HARD) and the recursive finish are not ported.
pub(crate) fn solve(st: &mut State, tier: Tier, mut rec: Option<&mut Recorder>) -> Outcome {
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

/// The edges a step on island `i` can have made final: its own, the
/// other edges of the islands at their far ends (filling an island
/// finalises the rest of it), and the edges those bridges now cross.
/// Every other edge has the same count, the same room at both ends and
/// the same crossings as before the step, so `is_final` cannot have
/// changed for it. Ascending and deduplicated, so conclusions come out in
/// edge order as they did when this scanned the whole list — which made
/// trace generation quadratic in the edge count.
fn affected(st: &State, i: usize) -> Vec<usize> {
    let mut out = Vec::new();
    for e in st.island_edges(i) {
        let edge = &st.edges[e];
        out.push(e);
        out.extend(edge.crossings.iter().copied());
        out.extend(st.island_edges(edge.a));
        out.extend(st.island_edges(edge.b));
    }
    out.sort_unstable();
    out.dedup();
    out
}

/// Every edge that just became final and has not been concluded before
/// gets its value recorded; one Hint per technique application that fixes
/// at least one edge. `target` is the part of `focus` the technique's
/// sentence points at, and every key it returns must also be in `focus`.
fn conclude(
    st: &State,
    rec: &mut Option<&mut Recorder>,
    i: usize,
    technique: Technique,
    focus: impl FnOnce(&State) -> Vec<u16>,
    target: impl FnOnce(&State) -> Vec<u16>,
) {
    let Some(r) = rec else {
        return;
    };
    let mut conclusions = Vec::new();
    for e in affected(st, i) {
        if !r.concluded[e] && st.is_final(e) {
            r.concluded[e] = true;
            conclusions.push((st.edges[e].key, st.lines[e]));
        }
    }
    if conclusions.is_empty() {
        return;
    }
    let focus = focus(st);
    let target = target(st);
    debug_assert!(!target.is_empty() && target.iter().all(|k| focus.contains(k)));
    r.hints.push(Hint {
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
fn stage1(st: &mut State, i: usize, rec: &mut Option<&mut Recorder>) -> Result<bool, ()> {
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
            i,
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
            i,
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
fn stage2(st: &mut State, i: usize, rec: &mut Option<&mut Recorder>) -> bool {
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
        i,
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
///
/// `budget` bounds the nodes as `depth` bounds one branch: an island-rich
/// description from outside has hundreds of open edges, so the depth cap
/// never fires however wide the tree gets. Both stop by claiming the cap,
/// which reads as "more than one solution".
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
        total += count_solutions(&mut branch, cap - total, depth + 1, budget);
        if total >= cap {
            return cap;
        }
    }
    total
}
