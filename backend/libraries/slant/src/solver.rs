use crate::state::State;
use crate::{Hint, Technique, Tier, encode_slash, vertex_key};
use puzzle_core::Dsf;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    NoSolution,
    /// Techniques exhausted with cells still undecided (Tatham's 2).
    Stuck,
}

/// Port of `solver_scratch`.
struct Scratch {
    /// Connected sets of vertices.
    connected: Dsf,
    /// Possible simultaneous exits from each connected set (indexed by the
    /// set's canonical vertex).
    exits: Vec<i32>,
    /// Whether each connected set touches the border (canonical index).
    border: Vec<bool>,
    /// Cells known to slant the same way.
    equiv: Dsf,
    /// Known slash value per equivalence class (canonical index).
    slashval: Vec<i8>,
    /// Possible v-shapes: bit 0 = v with the cell to the right, bit 1 =
    /// ^ with the cell to the right, bit 2 = > with the cell below, bit 3
    /// = < with the cell below.
    vbitmap: Vec<u8>,
}

impl Scratch {
    fn new(st: &State) -> Self {
        let (vw, nv) = (st.vw(), st.vertices());
        let vh = st.h + 1;
        let mut border = vec![false; nv];
        let mut exits = vec![0i32; nv];
        for vy in 0..vh {
            for vx in 0..vw {
                let v = vy * vw + vx;
                border[v] = vy == 0 || vy == vh - 1 || vx == 0 || vx == vw - 1;
                exits[v] = st.clues[v].map_or(4, |c| c as i32);
            }
        }
        Scratch {
            connected: Dsf::new(nv),
            exits,
            border,
            equiv: Dsf::new(st.size()),
            slashval: vec![0; st.size()],
            vbitmap: vec![0xF; st.size()],
        }
    }

    /// Port of `merge_vertices`: union plus exit/border bookkeeping.
    fn merge_vertices(&mut self, a: usize, b: usize) {
        let i = self.connected.find(a);
        let j = self.connected.find(b);
        let exits = self.exits[i] + self.exits[j] - 2;
        let border = self.border[i] || self.border[j];
        self.connected.merge(i, j);
        let r = self.connected.find(i);
        self.exits[r] = exits;
        self.border[r] = border;
    }

    /// Port of `decr_exits`: one way out of a non-clue vertex was blocked.
    fn decr_exits(&mut self, st: &State, v: usize) {
        if st.clues[v].is_none() {
            let r = self.connected.find(v);
            self.exits[r] -= 1;
        }
    }

    /// Port of `vbitmap_clear`.
    fn vclear(&mut self, cell: usize, bits: u8) -> bool {
        let cleared = self.vbitmap[cell] & bits;
        self.vbitmap[cell] &= !bits;
        cleared != 0
    }

    /// Mark two cells as slanting the same way. Unlike Tatham, the known
    /// slash value (if either class has one) is carried onto the merged
    /// class regardless of which root the union picks. Err if the two
    /// classes already hold different slash values.
    fn merge_equiv(&mut self, a: usize, b: usize) -> Result<bool, ()> {
        let ra = self.equiv.find(a);
        let rb = self.equiv.find(b);
        if ra == rb {
            return Ok(false);
        }
        let (sa, sb) = (self.slashval[ra], self.slashval[rb]);
        if sa != 0 && sb != 0 && sa != sb {
            return Err(());
        }
        self.equiv.merge(ra, rb);
        let r = self.equiv.find(ra);
        self.slashval[r] = if sa != 0 { sa } else { sb };
        Ok(true)
    }
}

fn push_hint(rec: &mut Option<&mut Vec<Hint>>, hint: Hint) {
    if let Some(v) = rec {
        v.push(hint);
    }
}

/// Port of `fill_square`. False if the cell already holds the other
/// slash, if this slash would close a loop, or if it contradicts the
/// cell's equivalence class.
fn fill_square(st: &mut State, sc: &mut Scratch, i: usize, v: i8) -> bool {
    if st.soln[i] == v {
        return true;
    }
    if st.soln[i] != 0 {
        return false;
    }
    let (c1, c2) = st.endpoints(i, v);
    let (d1, d2) = st.endpoints(i, -v);
    if sc.connected.equivalent(c1, c2) {
        return false;
    }
    let e = sc.equiv.find(i);
    if sc.slashval[e] != 0 && sc.slashval[e] != v {
        return false;
    }
    st.soln[i] = v;
    sc.slashval[e] = v;
    sc.merge_vertices(c1, c2);
    sc.decr_exits(st, d1);
    sc.decr_exits(st, d2);
    true
}

/// Port of `slant_solve` (which never recurses at any difficulty): run
/// the clue-point, square and (Tricky only) v-shape passes to a fixed
/// point. Starts from an empty grid, as Tatham does.
pub(crate) fn solve(st: &mut State, tier: Tier, mut rec: Option<&mut Vec<Hint>>) -> Outcome {
    for v in st.soln.iter_mut() {
        *v = 0;
    }
    let tricky = tier == Tier::Tricky;
    let mut sc = Scratch::new(st);
    let (vw, vh) = (st.vw(), st.h + 1);

    loop {
        let mut did = false;
        for vy in 0..vh {
            for vx in 0..vw {
                match clue_point(st, &mut sc, vx, vy, tricky, &mut rec) {
                    Ok(true) => did = true,
                    Ok(false) => {}
                    Err(()) => return Outcome::NoSolution,
                }
            }
        }
        if did {
            continue;
        }

        for i in 0..st.size() {
            match square(st, &mut sc, i, tricky, &mut rec) {
                Ok(true) => did = true,
                Ok(false) => {}
                Err(()) => return Outcome::NoSolution,
            }
        }
        if did {
            continue;
        }

        if !tricky {
            break;
        }
        match vbitmap_pass(st, &mut sc) {
            Ok(true) => {}
            Ok(false) => break,
            Err(()) => return Outcome::NoSolution,
        }
    }

    if st.filled() { Outcome::Solved } else { Outcome::Stuck }
}

/// One clue point of the first pass: fill or empty every undecided cell
/// around a clue whose remaining line count is zero or equals the number
/// of undecided cells; on Tricky, two adjacent undecided cells known to
/// slant the same way count as one line, and a clue with exactly one line
/// left between two adjacent undecided cells marks them equivalent.
fn clue_point(
    st: &mut State,
    sc: &mut Scratch,
    vx: usize,
    vy: usize,
    tricky: bool,
    rec: &mut Option<&mut Vec<Hint>>,
) -> Result<bool, ()> {
    let vertex = vy * st.vw() + vx;
    let Some(c) = st.clues[vertex] else {
        return Ok(false);
    };
    let (nb, n) = st.vertex_neighbours(vx, vy);
    let nb = &nb[..n];

    let mut nu = 0i32;
    let mut nl = c as i32;
    let mut last = nb[n - 1].0;
    let mut eq = if st.soln[last] == 0 { Some(sc.equiv.find(last)) } else { None };
    let mut meq = None;
    let (mut mj1, mut mj2) = (usize::MAX, usize::MAX);
    for &(j, s) in nb {
        if st.soln[j] == 0 {
            nu += 1;
            if meq.is_none() && tricky {
                let eq2 = sc.equiv.find(j);
                if eq == Some(eq2) && last != j {
                    meq = Some(eq2);
                    mj1 = last;
                    mj2 = j;
                    nl -= 1;
                    nu -= 2;
                } else {
                    eq = Some(eq2);
                }
            }
        } else {
            eq = None;
            if st.soln[j] == s {
                nl -= 1;
            }
        }
        last = j;
    }

    if nl < 0 || nl > nu {
        return Err(());
    }

    if nu > 0 && (nl == 0 || nl == nu) {
        let mut conclusions = Vec::new();
        for &(j, s) in nb {
            if st.soln[j] == 0 && j != mj1 && j != mj2 {
                let v = if nl != 0 { s } else { -s };
                if !fill_square(st, sc, j, v) {
                    return Err(());
                }
                conclusions.push((j as u16, encode_slash(v)));
            }
        }
        if rec.is_some() {
            let technique = if meq.is_some() {
                Technique::PairedClue
            } else if nl == 0 {
                Technique::ClueSatisfied
            } else {
                Technique::ClueForced
            };
            // All three clue-point techniques say "this number", so the
            // vertex is the target and the cells around it are context.
            let key = vertex_key(st.w, st.h, vertex);
            let mut focus = vec![key];
            focus.extend(nb.iter().map(|&(j, _)| j as u16));
            push_hint(
                rec,
                Hint {
                    technique,
                    focus,
                    target: vec![key],
                    conclusions,
                },
            );
        }
        return Ok(true);
    }

    if nu == 2 && nl == 1 && tricky {
        let mut first: Option<usize> = None;
        let mut pair = None;
        for (i, &(j, _)) in nb.iter().enumerate() {
            if st.soln[j] == 0 && j != mj1 && j != mj2 {
                match first {
                    None => first = Some(i),
                    Some(f) if f + 1 == i || (f == 0 && i == 3) => {
                        pair = Some((f, i));
                        break;
                    }
                    Some(_) => {}
                }
            }
        }
        if let Some((a, b)) = pair {
            // Equivalences fix no cell, so no hint and (as in Tatham) no
            // "did something" either; the square pass consumes them.
            sc.merge_equiv(nb[a].0, nb[b].0)?;
        }
    }
    Ok(false)
}

/// Which technique (if any) forces slash `v` in cell `i`: the corners
/// the other slash would join are already connected (loop), or the cell's
/// equivalence class is known (Tricky), or joining them would seal two
/// dead-end groups (Tricky).
fn forced(st: &State, sc: &mut Scratch, i: usize, v: i8, class_val: i8, tricky: bool) -> Option<Technique> {
    let (a, b) = st.endpoints(i, -v);
    let c1 = sc.connected.find(a);
    let c2 = sc.connected.find(b);
    if c1 == c2 {
        return Some(Technique::LoopAvoidance);
    }
    if !tricky {
        return None;
    }
    if class_val == v {
        return Some(Technique::Equivalence);
    }
    if !sc.border[c1] && !sc.border[c2] && sc.exits[c1] <= 1 && sc.exits[c2] <= 1 {
        return Some(Technique::DeadEndAvoidance);
    }
    None
}

fn focus_for(st: &State, sc: &mut Scratch, i: usize, v: i8, technique: Technique) -> Vec<u16> {
    let mut focus = vec![i as u16];
    match technique {
        Technique::LoopAvoidance => {
            let (a, b) = st.endpoints(i, -v);
            focus.extend(st.path_cells(a, b).into_iter().map(|c| c as u16));
        }
        Technique::Equivalence => {
            let class = sc.equiv.find(i);
            for j in 0..st.size() {
                if j != i && st.soln[j] != 0 && sc.equiv.find(j) == class {
                    focus.push(j as u16);
                }
            }
        }
        Technique::DeadEndAvoidance => {
            let (a, b) = st.endpoints(i, -v);
            let c1 = sc.connected.find(a);
            let c2 = sc.connected.find(b);
            for j in 0..st.size() {
                if st.soln[j] != 0 {
                    let (e, _) = st.endpoints(j, st.soln[j]);
                    let r = sc.connected.find(e);
                    if r == c1 || r == c2 {
                        focus.push(j as u16);
                    }
                }
            }
            for vtx in 0..st.vertices() {
                let r = sc.connected.find(vtx);
                if r == c1 || r == c2 {
                    focus.push(vertex_key(st.w, st.h, vtx));
                }
            }
        }
        _ => {}
    }
    focus
}

/// One cell of the second pass.
fn square(st: &mut State, sc: &mut Scratch, i: usize, tricky: bool, rec: &mut Option<&mut Vec<Hint>>) -> Result<bool, ()> {
    if st.soln[i] != 0 {
        return Ok(false);
    }
    let class_val = if tricky { sc.slashval[sc.equiv.find(i)] } else { 0 };
    let fs = forced(st, sc, i, 1, class_val, tricky);
    let bs = forced(st, sc, i, -1, class_val, tricky);
    let (v, technique) = match (fs, bs) {
        (Some(_), Some(_)) => return Err(()),
        (Some(t), None) => (1, t),
        (None, Some(t)) => (-1, t),
        (None, None) => return Ok(false),
    };
    let focus = if rec.is_some() { focus_for(st, sc, i, v, technique) } else { Vec::new() };
    if !fill_square(st, sc, i, v) {
        return Err(());
    }
    // All three square techniques say "this cell"; `focus_for` puts it
    // first and the rest of the focus is the chain, class or group.
    push_hint(
        rec,
        Hint {
            technique,
            focus,
            target: vec![i as u16],
            conclusions: vec![(i as u16, encode_slash(v))],
        },
    );
    Ok(true)
}

/// Third pass (Tricky only): maintain the v-shape bitmap and turn
/// "neither v-shape possible" into equivalences. Fixes no cell directly.
fn vbitmap_pass(st: &mut State, sc: &mut Scratch) -> Result<bool, ()> {
    let (w, h, vw) = (st.w, st.h, st.vw());
    let mut did = false;
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let s = st.soln[i];
            if s != 0 {
                if x > 0 {
                    did |= sc.vclear(i - 1, if s < 0 { 0x1 } else { 0x2 });
                }
                if x + 1 < w {
                    did |= sc.vclear(i, if s < 0 { 0x2 } else { 0x1 });
                }
                if y > 0 {
                    did |= sc.vclear(i - w, if s < 0 { 0x4 } else { 0x8 });
                }
                if y + 1 < h {
                    did |= sc.vclear(i, if s < 0 { 0x8 } else { 0x4 });
                }
            }

            if x + 1 < w && sc.vbitmap[i] & 0x3 == 0 {
                did |= sc.merge_equiv(i, i + 1)?;
            }
            if y + 1 < h && sc.vbitmap[i] & 0xC == 0 {
                did |= sc.merge_equiv(i, i + w)?;
            }

            // The rest works around the interior vertex at the cell's
            // top-left corner.
            if y == 0 || x == 0 {
                continue;
            }
            let Some(c) = st.clues[y * vw + x] else {
                continue;
            };
            let tl = (y - 1) * w + (x - 1);
            let bl = y * w + (x - 1);
            let tr = (y - 1) * w + x;
            match c {
                1 => {
                    did |= sc.vclear(tl, 0x5);
                    did |= sc.vclear(bl, 0x2);
                    did |= sc.vclear(tr, 0x8);
                }
                3 => {
                    did |= sc.vclear(tl, 0xA);
                    did |= sc.vclear(bl, 0x1);
                    did |= sc.vclear(tr, 0x4);
                }
                2 => {
                    let bits = (sc.vbitmap[bl] & 0x3) ^ 0x3;
                    did |= sc.vclear(tl, bits);
                    let bits = (sc.vbitmap[tr] & 0xC) ^ 0xC;
                    did |= sc.vclear(tl, bits);
                    let bits = (sc.vbitmap[tl] & 0x3) ^ 0x3;
                    did |= sc.vclear(bl, bits);
                    let bits = (sc.vbitmap[tl] & 0xC) ^ 0xC;
                    did |= sc.vclear(tr, bits);
                }
                _ => {}
            }
        }
    }
    Ok(did)
}

/// Can slash `v` go in cell `i` without closing a loop or making one of
/// its four corner clues unsatisfiable?
fn feasible(st: &State, soln: &[i8], dsf: &mut Dsf, i: usize, v: i8) -> bool {
    let (a, b) = st.endpoints(i, v);
    if dsf.equivalent(a, b) {
        return false;
    }
    let (w, vw) = (st.w, st.vw());
    let (x, y) = (i % w, i / w);
    for (vx, vy) in [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)] {
        let Some(c) = st.clues[vy * vw + vx] else {
            continue;
        };
        let (nb, n) = st.vertex_neighbours(vx, vy);
        let (mut lines, mut undecided) = (0i32, 0i32);
        for &(j, s) in &nb[..n] {
            let val = if j == i { v } else { soln[j] };
            if val == 0 {
                undecided += 1;
            } else if val == s {
                lines += 1;
            }
        }
        if lines > c as i32 || lines + undecided < c as i32 {
            return false;
        }
    }
    true
}

/// Exhaustive solution count, capped. Independent of the technique
/// solver: generic constraint propagation (a cell with one feasible slash
/// takes it; a cell with none kills the branch) plus branching on the
/// first cell with two feasible slashes.
pub(crate) fn count_solutions(st: &State, cap: u32) -> u32 {
    let soln = vec![0i8; st.size()];
    let dsf = Dsf::new(st.vertices());
    count_rec(st, soln, dsf, cap)
}

fn count_rec(st: &State, mut soln: Vec<i8>, mut dsf: Dsf, cap: u32) -> u32 {
    let branch = loop {
        let mut changed = false;
        let mut branch = None;
        for i in 0..st.size() {
            if soln[i] != 0 {
                continue;
            }
            let back = feasible(st, &soln, &mut dsf, i, -1);
            let fwd = feasible(st, &soln, &mut dsf, i, 1);
            match (back, fwd) {
                (false, false) => return 0,
                (true, true) => {
                    if branch.is_none() {
                        branch = Some(i);
                    }
                }
                (b, _) => {
                    let v = if b { -1 } else { 1 };
                    soln[i] = v;
                    let (a, c) = st.endpoints(i, v);
                    dsf.merge(a, c);
                    changed = true;
                }
            }
        }
        if !changed {
            break branch;
        }
    };
    let Some(i) = branch else {
        return 1;
    };
    let mut total = 0;
    for v in [-1i8, 1] {
        let mut s = soln.clone();
        let mut d = dsf.clone();
        s[i] = v;
        let (a, b) = st.endpoints(i, v);
        d.merge(a, b);
        total += count_rec(st, s, d, cap - total);
        if total >= cap {
            return cap;
        }
    }
    total
}
