use crate::dsf::Dsf;
use crate::state::{Line, State};
use crate::{Hint, Technique, Tier};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    NoSolution,
    /// Techniques exhausted with edges still undecided.
    Stuck,
    /// Drawing this edge closed a loop that satisfies every clue, but no
    /// deduction forced it (Tatham's SOLVER_AMBIGUOUS): a solution, not
    /// provably the only one.
    Ambiguous(usize),
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Status {
    Incomplete,
    Mistake,
    Solved,
    Ambiguous(usize),
}

struct Ctx<'a> {
    status: Status,
    rec: Option<&'a mut Vec<Hint>>,
}

impl Ctx<'_> {
    fn record(&mut self, hint: impl FnOnce() -> Hint) {
        if let Some(v) = &mut self.rec {
            v.push(hint());
        }
    }
}

/// Tatham's difficulty ladder, minus the tiers this crate does not port.
/// Each solver returns the lowest tier that could use what it just did,
/// or DIFF_MAX for no progress.
type Diff = u8;
type Solver = fn(&mut State, &mut Ctx) -> Diff;
const DIFF_EASY: Diff = 0;
const DIFF_NORMAL: Diff = 1;
const DIFF_MAX: Diff = Diff::MAX;

/// Port of `solve_game_rec` (which, despite its name, never recurses):
/// run the solvers in order, restarting from the top whenever one makes
/// progress, skipping solvers that cannot use the last kind of progress.
pub(crate) fn solve(st: &mut State, tier: Tier, rec: Option<&mut Vec<Hint>>) -> Outcome {
    let max_diff = match tier {
        Tier::Easy => DIFF_EASY,
        Tier::Tricky => DIFF_NORMAL,
    };
    let solvers: [(Solver, Diff); 3] = [
        (trivial_deductions, DIFF_EASY),
        (dline_deductions, DIFF_NORMAL),
        (loop_deductions, DIFF_EASY),
    ];
    let mut cx = Ctx {
        status: Status::Incomplete,
        rec,
    };
    let (mut threshold_diff, mut threshold_index, mut i) = (DIFF_EASY, 0, 0);
    while i < solvers.len() {
        match cx.status {
            Status::Mistake => return Outcome::NoSolution,
            Status::Solved | Status::Ambiguous(_) => break,
            Status::Incomplete => {}
        }
        let (solver, diff) = solvers[i];
        if (diff >= threshold_diff || i >= threshold_index) && diff <= max_diff {
            let next = solver(st, &mut cx);
            if next != DIFF_MAX {
                threshold_diff = next;
                threshold_index = i;
                i = 0;
                continue;
            }
        }
        i += 1;
    }
    match cx.status {
        Status::Mistake => Outcome::NoSolution,
        Status::Incomplete => Outcome::Stuck,
        Status::Ambiguous(e) => Outcome::Ambiguous(e),
        Status::Solved => {
            let rest: Vec<usize> = (0..st.grid.edges()).filter(|&e| st.lines[e] == Line::Unknown).collect();
            if !rest.is_empty() {
                let mut focus: Vec<u16> = (0..st.grid.edges())
                    .filter(|&e| st.lines[e] == Line::Yes)
                    .map(|e| e as u16)
                    .collect();
                // The sentence points at the edges being crossed off; the
                // finished loop is the context around them.
                let target: Vec<u16> = rest.iter().map(|&e| e as u16).collect();
                focus.extend(target.iter().copied());
                for &e in &rest {
                    st.set_line(e, Line::No);
                }
                cx.record(|| Hint {
                    technique: Technique::LoopClosed,
                    focus,
                    target,
                    conclusions: rest.iter().map(|&e| (e as u16, 0)).collect(),
                });
            }
            Outcome::Solved
        }
    }
}

/// Focus marker for a cell: cell indices sit above the edge range.
fn cell_marker(st: &State, f: usize) -> u16 {
    (st.grid.edges() + f) as u16
}

/// Focus marker for a dot: dot indices sit above the cell range.
fn dot_marker(st: &State, d: usize) -> u16 {
    (st.grid.edges() + st.grid.cells() + d) as u16
}

fn push_unique(v: &mut Vec<u16>, x: u16) {
    if !v.contains(&x) {
        v.push(x);
    }
}

/// The clue cell and its four edges.
fn cell_focus(st: &State, f: usize) -> Vec<u16> {
    let mut focus = vec![cell_marker(st, f)];
    focus.extend(st.grid.cell_edges(f).map(|e| e as u16));
    focus
}

/// Just the edges at a dot, for deductions the dot itself is only context for.
fn dot_edges_focus(st: &State, d: usize) -> Vec<u16> {
    st.grid.dot_edges(d).iter().map(|&e| e as u16).collect()
}

/// The dot and its edges.
fn dot_focus(st: &State, d: usize) -> Vec<u16> {
    let mut focus = vec![dot_marker(st, d)];
    focus.extend(dot_edges_focus(st, d));
    focus
}

/// Port of `face_setall`: returns the edges it changed.
fn face_setall(st: &mut State, f: usize, from: Line, to: Line) -> Vec<usize> {
    let mut changed = Vec::new();
    for e in st.grid.cell_edges(f) {
        if st.lines[e] == from && st.set_line(e, to) {
            changed.push(e);
        }
    }
    changed
}

/// Port of `dot_setall`.
fn dot_setall(st: &mut State, d: usize, from: Line, to: Line) -> Vec<usize> {
    let mut changed = Vec::new();
    for &e in st.grid.dot_edges(d).iter() {
        if st.lines[e] == from && st.set_line(e, to) {
            changed.push(e);
        }
    }
    changed
}

/// Port of `trivial_deductions`: the rules of the game applied one cell
/// or one dot at a time.
fn trivial_deductions(st: &mut State, cx: &mut Ctx) -> Diff {
    let mut diff = DIFF_MAX;

    for f in 0..st.grid.cells() {
        if st.face_solved[f] {
            continue;
        }
        let (yes, no) = (st.face_yes[f], st.face_no[f]);
        if yes + no == 4 {
            st.face_solved[f] = true;
            continue;
        }
        let Some(clue) = st.clues[f] else {
            continue;
        };

        if clue < yes {
            cx.status = Status::Mistake;
            return DIFF_EASY;
        }
        if clue == yes {
            let changed = face_setall(st, f, Line::Unknown, Line::No);
            if !changed.is_empty() {
                diff = DIFF_EASY;
                cx.record(|| Hint {
                    technique: Technique::ClueSatisfied,
                    focus: cell_focus(st, f),
                    target: vec![cell_marker(st, f)],
                    conclusions: changed.iter().map(|&e| (e as u16, 0)).collect(),
                });
            }
            st.face_solved[f] = true;
            continue;
        }

        if 4 - clue < no {
            cx.status = Status::Mistake;
            return DIFF_EASY;
        }
        if 4 - clue == no {
            let changed = face_setall(st, f, Line::Unknown, Line::Yes);
            if !changed.is_empty() {
                diff = DIFF_EASY;
                cx.record(|| Hint {
                    technique: Technique::ClueNeedsAll,
                    focus: cell_focus(st, f),
                    target: vec![cell_marker(st, f)],
                    conclusions: changed.iter().map(|&e| (e as u16, 1)).collect(),
                });
            }
            st.face_solved[f] = true;
            continue;
        }

        if 4 - clue == no + 1 && 4 - yes - no > 2 {
            // The clue needs all but one of its unknown edges. An adjacent
            // unknown pair whose shared corner already has a line entering
            // from outside cannot both be lines, so every other unknown
            // edge of the cell must be.
            let edges = st.grid.cell_edges(f);
            let dots = st.grid.cell_dots(f);
            let found = (0..4).find(|&j| {
                let (e1, e2, d) = (edges[j], edges[(j + 1) % 4], dots[(j + 1) % 4]);
                st.lines[e1] == Line::Unknown
                    && st.lines[e2] == Line::Unknown
                    && st.grid.dot_edges(d).iter().any(|&e| st.lines[e] == Line::Yes)
            });
            let Some(j) = found else {
                continue;
            };
            let (e1, e2, d) = (edges[j], edges[(j + 1) % 4], dots[(j + 1) % 4]);
            let mut changed = Vec::new();
            for e in edges {
                if st.lines[e] == Line::Unknown && e != e1 && e != e2 && st.set_line(e, Line::Yes) {
                    changed.push(e);
                }
            }
            if !changed.is_empty() {
                diff = DIFF_EASY;
                cx.record(|| {
                    let mut focus = cell_focus(st, f);
                    for e in dot_edges_focus(st, d) {
                        push_unique(&mut focus, e);
                    }
                    Hint {
                        technique: Technique::LineEntersClue,
                        focus,
                        target: vec![cell_marker(st, f)],
                        conclusions: changed.iter().map(|&e| (e as u16, 1)).collect(),
                    }
                });
            }
        }
    }

    for d in 0..st.grid.dots() {
        if st.dot_solved[d] {
            continue;
        }
        let (yes, no) = (st.dot_yes[d], st.dot_no[d]);
        let unknown = st.dot_order(d) - yes - no;
        match yes {
            0 => {
                if unknown == 0 {
                    st.dot_solved[d] = true;
                } else if unknown == 1 {
                    let changed = dot_setall(st, d, Line::Unknown, Line::No);
                    diff = DIFF_EASY;
                    cx.record(|| Hint {
                        technique: Technique::DeadEnd,
                        focus: dot_focus(st, d),
                        target: vec![dot_marker(st, d)],
                        conclusions: changed.iter().map(|&e| (e as u16, 0)).collect(),
                    });
                    st.dot_solved[d] = true;
                }
            }
            1 => {
                if unknown == 0 {
                    cx.status = Status::Mistake;
                    return DIFF_EASY;
                } else if unknown == 1 {
                    let changed = dot_setall(st, d, Line::Unknown, Line::Yes);
                    diff = DIFF_EASY;
                    cx.record(|| Hint {
                        technique: Technique::OnlyExit,
                        focus: dot_focus(st, d),
                        target: vec![dot_marker(st, d)],
                        conclusions: changed.iter().map(|&e| (e as u16, 1)).collect(),
                    });
                }
            }
            2 => {
                if unknown > 0 {
                    let changed = dot_setall(st, d, Line::Unknown, Line::No);
                    diff = DIFF_EASY;
                    cx.record(|| Hint {
                        technique: Technique::DotComplete,
                        focus: dot_focus(st, d),
                        target: vec![dot_marker(st, d)],
                        conclusions: changed.iter().map(|&e| (e as u16, 0)).collect(),
                    });
                }
                st.dot_solved[d] = true;
            }
            _ => {
                cx.status = Status::Mistake;
                return DIFF_EASY;
            }
        }
    }

    diff
}

/// Focus for a corner-pair deduction: the clue cell and every edge at its
/// four corners, which is where the pair constraints came from.
fn corner_focus(st: &State, f: usize) -> Vec<u16> {
    let mut focus = cell_focus(st, f);
    for d in st.grid.cell_dots(f) {
        for e in dot_edges_focus(st, d) {
            push_unique(&mut focus, e);
        }
    }
    focus
}

/// Port of `dline_deductions` at Tatham's DIFF_NORMAL. A dline is an
/// adjacent pair of edges at a dot, carrying "at least one is a line" /
/// "at most one is a line" flags. Cells combine the flags around their
/// corners into bounds on their line count; dots set the flags from the
/// lines already present. Tatham's dot-side rules that turn a flag plus
/// one known edge into the other edge's state are omitted: below
/// DIFF_TRICKY the flags only ever come from a dot's own lines, so
/// trivial_deductions has always drawn the same conclusion first.
fn dline_deductions(st: &mut State, cx: &mut Ctx) -> Diff {
    let mut diff = DIFF_MAX;

    for f in 0..st.grid.cells() {
        if st.face_solved[f] {
            continue;
        }
        let Some(clue) = st.clues[f] else {
            continue;
        };
        let clue = clue as i8;
        let edges = st.grid.cell_edges(f);

        // maxs[j][k] / mins[j][k]: bounds on the number of lines among
        // edges j..k going clockwise (edge j joins corner j to corner j+1).
        let mut maxs = [[0i8; 4]; 4];
        let mut mins = [[0i8; 4]; 4];
        for j in 0..4 {
            let k = (j + 1) % 4;
            let line1 = st.lines[edges[j]];
            maxs[j][k] = (line1 != Line::No) as i8;
            mins[j][k] = (line1 == Line::Yes) as i8;

            let dl = st.dline_of_corner(f, k);
            let line2 = st.lines[edges[k]];
            let k2 = (k + 1) % 4;
            let mut max = 2 - (line1 == Line::No) as i8 - (line2 == Line::No) as i8;
            if max == 2 && st.is_atmostone(dl) {
                max = 1;
            }
            maxs[j][k2] = max;
            let mut min = (line1 == Line::Yes) as i8 + (line2 == Line::Yes) as i8;
            if min == 0 && st.is_atleastone(dl) {
                min = 1;
            }
            mins[j][k2] = min;
        }
        for j in 0..4 {
            let (k, u, v) = ((j + 3) % 4, (j + 1) % 4, (j + 2) % 4);
            maxs[j][k] = (maxs[j][u] + maxs[u][k]).min(maxs[j][v] + maxs[v][k]);
            mins[j][k] = (mins[j][u] + mins[u][k]).max(mins[j][v] + mins[v][k]);
        }

        for j in 0..4 {
            let e = edges[j];
            if st.lines[e] != Line::Unknown {
                continue;
            }
            let k = (j + 1) % 4;
            // Bounds on the lines among the other three edges.
            if mins[k][j] > clue {
                cx.status = Status::Mistake;
                return DIFF_EASY;
            }
            if mins[k][j] == clue && st.set_line(e, Line::No) {
                diff = DIFF_EASY;
                cx.record(|| Hint {
                    technique: Technique::CornerPairsFull,
                    focus: corner_focus(st, f),
                    target: vec![cell_marker(st, f)],
                    conclusions: vec![(e as u16, 0)],
                });
            }
            if maxs[k][j] < clue - 1 {
                cx.status = Status::Mistake;
                return DIFF_EASY;
            }
            if maxs[k][j] == clue - 1 && st.set_line(e, Line::Yes) {
                diff = DIFF_EASY;
                cx.record(|| Hint {
                    technique: Technique::CornerPairsShort,
                    focus: corner_focus(st, f),
                    target: vec![cell_marker(st, f)],
                    conclusions: vec![(e as u16, 1)],
                });
            }
        }
    }

    if diff < DIFF_NORMAL {
        return diff;
    }

    for d in 0..st.grid.dots() {
        if st.dot_solved[d] {
            continue;
        }
        let de = st.grid.dot_edges(d);
        let n = de.len();
        for j in 0..n {
            let k = (j + 1) % n;
            let dl = st.dline_index(d, j);
            let (e1, e2) = (de[j], de[k]);
            let (line1, line2) = (st.lines[e1], st.lines[e2]);

            if (line1 == Line::No || line2 == Line::No) && st.set_atmostone(dl) {
                diff = diff.min(DIFF_NORMAL);
            }
            if (line1 == Line::Yes || line2 == Line::Yes) && st.set_atleastone(dl) {
                diff = diff.min(DIFF_NORMAL);
            }
            if line1 != Line::Unknown || line2 != Line::Unknown {
                continue;
            }
            let yes = st.dot_yes[d];
            let unknown = n as u8 - yes - st.dot_no[d];
            if yes == 1 {
                if st.set_atmostone(dl) {
                    diff = diff.min(DIFF_NORMAL);
                }
                if unknown == 2 && st.set_atleastone(dl) {
                    diff = diff.min(DIFF_NORMAL);
                }
            }
        }
    }

    diff
}

/// Port of `loop_deductions`: track the chains of lines; an unknown edge
/// joining two ends of the same chain would close a loop, which is wrong
/// unless it would be the whole solution.
fn loop_deductions(st: &mut State, cx: &mut Ctx) -> Diff {
    let grid = st.grid;
    let mut dsf = Dsf::new(grid.dots());
    let mut edgecount = 0;
    for e in 0..grid.edges() {
        if st.lines[e] == Line::Yes {
            let (a, b) = grid.edge_dots(e);
            dsf.merge(a, b);
            edgecount += 1;
        }
    }

    let (mut clues, mut satclues, mut sm1clues) = (0, 0, 0);
    for f in 0..grid.cells() {
        if let Some(c) = st.clues[f] {
            let o = st.face_yes[f];
            if o == c {
                satclues += 1;
            } else if o + 1 == c {
                sm1clues += 1;
            }
            clues += 1;
        }
    }

    let mut shortest_chain = grid.dots();
    for d in 0..grid.dots() {
        let size = dsf.size(d);
        if size > 1 {
            shortest_chain = shortest_chain.min(size);
        }
    }

    if satclues == clues && shortest_chain == edgecount {
        cx.status = Status::Solved;
        return DIFF_EASY;
    }

    let mut progress = false;
    for e in 0..grid.edges() {
        if st.lines[e] != Line::Unknown {
            continue;
        }
        let (d1, d2) = grid.edge_dots(e);
        let root = dsf.find(d1);
        if root != dsf.find(d2) {
            continue;
        }
        let mut val = Line::No;
        if dsf.size(root) == edgecount + 1 {
            // This edge would close a loop through every line drawn so
            // far. It is the solution if every clue is satisfied or one
            // short, and the short ones are exactly the cells beside it.
            let sm1_nearby = grid
                .edge_cells(e)
                .into_iter()
                .flatten()
                .filter(|&f| st.clues[f].is_some_and(|c| st.face_yes[f] + 1 == c))
                .count();
            if sm1clues == sm1_nearby && sm1clues + satclues == clues {
                val = Line::Yes;
            }
        }
        st.set_line(e, val);
        progress = true;
        if val == Line::Yes {
            cx.status = Status::Ambiguous(e);
            return DIFF_EASY;
        }
        cx.record(|| {
            let mut focus = vec![e as u16];
            for other in 0..grid.edges() {
                if st.lines[other] == Line::Yes && dsf.find(grid.edge_dots(other).0) == root {
                    focus.push(other as u16);
                }
            }
            Hint {
                technique: Technique::PrematureLoop,
                focus,
                target: vec![e as u16],
                conclusions: vec![(e as u16, 0)],
            }
        });
    }

    if progress { DIFF_EASY } else { DIFF_MAX }
}

/// Exhaustive solution count, capped. Runs the Easy deductions, then
/// branches on an undecided edge, preferring one that extends a chain.
pub(crate) fn count_solutions(st: &mut State, cap: u32) -> u32 {
    if cap == 0 {
        return 0;
    }
    let mut probe = st.clone();
    match solve(&mut probe, Tier::Easy, None) {
        Outcome::Solved => return 1,
        Outcome::NoSolution => return 0,
        Outcome::Ambiguous(e) => {
            // The closed loop is one solution; every other lies with this
            // edge absent.
            st.set_line(e, Line::No);
            return 1 + count_solutions(st, cap - 1);
        }
        Outcome::Stuck => {}
    }

    let grid = probe.grid;
    let unknown = |e: &usize| probe.lines[*e] == Line::Unknown;
    let extends_chain = |e: &usize| {
        let (a, b) = grid.edge_dots(*e);
        probe.dot_yes[a] == 1 || probe.dot_yes[b] == 1
    };
    let pick = (0..grid.edges())
        .find(|e| unknown(e) && extends_chain(e))
        .or_else(|| (0..grid.edges()).find(unknown));
    let Some(e) = pick else {
        return 0;
    };

    let mut with = probe.clone();
    with.set_line(e, Line::Yes);
    let mut total = count_solutions(&mut with, cap);
    if total >= cap {
        return cap;
    }
    probe.set_line(e, Line::No);
    total += count_solutions(&mut probe, cap - total);
    total.min(cap)
}
