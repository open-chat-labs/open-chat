use crate::state::{Dir, Square, State, offset};
use crate::{Cell, Description, Hint, Technique, Tier};
use puzzle_core::{MAX_SEARCH_DEPTH, SearchBudget};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    NoSolution,
    /// Techniques exhausted with blanks or unlinked trees remaining
    /// (Tatham's return value 2).
    Stuck,
}

fn record(rec: &mut Option<&mut Vec<Hint>>, hint: impl FnOnce() -> Hint) {
    if let Some(v) = rec {
        v.push(hint());
    }
}

/// Port of `tents_solve`. Every pass runs the technique groups in
/// Tatham's order and restarts from the top as soon as one of them does
/// something. Links (tree/tent pairings) are bookkeeping and never push a
/// hint; only squares newly fixed to tent or non-tent do.
pub(crate) fn solve(st: &mut State, tier: Tier, mut rec: Option<&mut Vec<Hint>>) -> Outcome {
    for l in st.links.iter_mut() {
        *l = None;
    }
    let n = st.size();

    loop {
        if !sound(st) {
            return Outcome::NoSolution;
        }
        let mut did = false;

        // Any tent with only one unattached tree adjacent to it is tied to
        // that tree.
        for i in 0..n {
            if st.grid[i] != Square::Tent || st.links[i].is_some() {
                continue;
            }
            let mut link = None;
            let mut several = false;
            for (d, j) in st.neighbours(i) {
                if st.grid[j] == Square::Tree && st.links[j].is_none() {
                    if link.is_some() {
                        several = true;
                        break;
                    }
                    link = Some((d, j));
                }
            }
            if several {
                continue;
            }
            let Some((d, j)) = link else {
                return Outcome::NoSolution;
            };
            st.links[i] = Some(d);
            st.links[j] = Some(d.flip());
            did = true;
        }
        if did {
            continue;
        }

        // A blank square not orthogonally adjacent to any unmatched tree
        // cannot be a tent.
        for i in 0..n {
            if st.grid[i] != Square::Blank {
                continue;
            }
            let can_be_tent = st
                .neighbours(i)
                .any(|(_, j)| st.grid[j] == Square::Tree && st.links[j].is_none());
            if can_be_tent {
                continue;
            }
            st.grid[i] = Square::NonTent;
            record(&mut rec, || {
                let mut focus = vec![i as u16];
                focus.extend(st.neighbours(i).map(|(_, j)| j as u16));
                Hint {
                    technique: Technique::NoFreeTree,
                    target: vec![i as u16],
                    focus,
                    conclusions: vec![(i as u16, 0)],
                }
            });
            did = true;
        }
        if did {
            continue;
        }

        // A blank square touching a tent, even diagonally, cannot be a
        // tent.
        for i in 0..n {
            if st.grid[i] != Square::Blank {
                continue;
            }
            let tents: Vec<u16> = st
                .around(i)
                .filter(|&j| st.grid[j] == Square::Tent)
                .map(|j| j as u16)
                .collect();
            if tents.is_empty() {
                continue;
            }
            st.grid[i] = Square::NonTent;
            record(&mut rec, || {
                let mut focus = vec![i as u16];
                focus.extend(tents);
                Hint {
                    technique: Technique::TentTouches,
                    target: vec![i as u16],
                    focus,
                    conclusions: vec![(i as u16, 0)],
                }
            });
            did = true;
        }
        if did {
            continue;
        }

        // A tree with exactly one {unattached tent, blank} adjacent to it
        // must have its tent there. (Tricky) Two candidates around a
        // corner rule out the square adjacent to both.
        for i in 0..n {
            if st.grid[i] != Square::Tree || st.links[i].is_some() {
                continue;
            }
            let cands: Vec<(Dir, usize)> = st
                .neighbours(i)
                .filter(|&(_, j)| st.grid[j] == Square::Blank || (st.grid[j] == Square::Tent && st.links[j].is_none()))
                .collect();
            match cands[..] {
                [] => return Outcome::NoSolution,
                [(d, j)] => {
                    if st.grid[j] == Square::Blank {
                        st.grid[j] = Square::Tent;
                        record(&mut rec, || {
                            let mut focus = vec![i as u16];
                            focus.extend(st.neighbours(i).map(|(_, k)| k as u16));
                            Hint {
                                technique: Technique::TreeNeedsTent,
                                target: vec![i as u16],
                                focus,
                                conclusions: vec![(j as u16, 1)],
                            }
                        });
                    }
                    st.links[i] = Some(d);
                    st.links[j] = Some(d.flip());
                    did = true;
                }
                [(d1, j1), (d2, j2)] if tier == Tier::Tricky && d1.horizontal() != d2.horizontal() => {
                    let corner = offset(st.w, st.h, i, d1.dx() + d2.dx(), d1.dy() + d2.dy())
                        .expect("corner of two on-grid neighbours is on the grid");
                    if st.grid[corner] == Square::Blank {
                        st.grid[corner] = Square::NonTent;
                        record(&mut rec, || Hint {
                            technique: Technique::TreeCorner,
                            target: vec![corner as u16],
                            focus: vec![i as u16, j1 as u16, j2 as u16, corner as u16],
                            conclusions: vec![(corner as u16, 0)],
                        });
                        did = true;
                    }
                }
                _ => {}
            }
        }
        if did {
            continue;
        }

        // A row or column whose count settles it outright: it needs as
        // many tents as it has squares that could still take one, or it
        // already has all of its tents. Every group above has run to a
        // standstill, so a blank square here is exactly a square that
        // could hold a tent: it has an unmatched tree beside it and no
        // tent touching it. That makes counting them a much more
        // convincing argument than the combinatorial pass below, which
        // would reach the same squares, so it goes first. Placing tents
        // can stop a blank in a later line from taking one, so a hit
        // restarts the whole loop rather than moving on to the next line.
        for line in 0..st.w + st.h {
            if line_count_exact(st, line, &mut rec) {
                did = true;
                break;
            }
        }
        if did {
            continue;
        }

        // Row and column counts.
        for line in 0..st.w + st.h {
            match line_deduce(st, tier, line, &mut rec) {
                Some(true) => did = true,
                Some(false) => {}
                None => return Outcome::NoSolution,
            }
        }
        if !did {
            break;
        }
    }

    for i in 0..n {
        if st.grid[i] == Square::Blank {
            return Outcome::Stuck;
        }
        if st.grid[i] != Square::NonTent && st.links[i].is_none() {
            return Outcome::Stuck;
        }
    }
    Outcome::Solved
}

/// Whether the grid is still consistent with the rules the solver is
/// entitled to assume: no two tents touching, and no line holding more
/// tents than its number.
///
/// Tatham's passes each reject their own contradictions, but several of
/// the passes here fix squares in bulk before the pass that would have
/// noticed: `line_count_exact` fills a whole line with tents on a count
/// argument alone, and one sweep of the tree pass can place two tents
/// next to each other. Without this the solver walks off a contradiction
/// and reports `Solved` on a grid `check_rules` calls broken. Each of the
/// other five games has the same check at the top of its loop.
fn sound(st: &State) -> bool {
    for i in 0..st.size() {
        if st.grid[i] == Square::Tent && st.around(i).any(|j| st.grid[j] == Square::Tent) {
            return false;
        }
    }
    (0..st.w + st.h).all(|line| {
        let (start, step, len) = line_span(st, line);
        let tents = (0..len).filter(|&j| st.grid[start + j * step] == Square::Tent).count();
        tents <= st.numbers[line] as usize
    })
}

/// How many placements one line may enumerate before `line_deduce` gives
/// up on it. C(n, k) grows fast enough that a handful of extra blanks is
/// the difference between instant and never, and a description arriving
/// from outside chooses n and k. Past the cap the line deduces nothing,
/// which is sound: skipping a technique loses deductions, it never
/// invents them.
const MAX_LINE_COMBINATIONS: u64 = 200_000;

/// Whether C(n, k) is above `cap`, without overflowing on the pairs where
/// it is astronomically above it.
fn combinations_exceed(n: usize, k: usize, cap: u64) -> bool {
    let k = k.min(n - k);
    let mut c: u64 = 1;
    for i in 0..k {
        // Exact at every step: after step i, c is C(n, i+1).
        c = c.saturating_mul((n - i) as u64) / (i as u64 + 1);
        if c > cap {
            return true;
        }
    }
    false
}

/// Tatham's next-combination step: move the rightmost movable tent one
/// place right and shunt everything after it as far left as it goes.
/// Returns false once the combinations are exhausted.
fn next_combination(place: &mut [bool]) -> bool {
    let n = place.len();
    let mut p = 0;
    let mut j = n - 1;
    while j > 0 {
        if place[j] {
            p += 1;
        }
        if !place[j] && place[j - 1] {
            place[j - 1] = false;
            place[j] = true;
            for _ in 0..p {
                j += 1;
                place[j] = true;
            }
            j += 1;
            while j < n {
                place[j] = false;
                j += 1;
            }
            return true;
        }
        j -= 1;
    }
    false
}

/// The squares of row or column `line`, indexed as `numbers` is (columns
/// first, then rows): first square, stride, length.
fn line_span(st: &State, line: usize) -> (usize, usize, usize) {
    if line < st.w { (line, st.w, st.h) } else { ((line - st.w) * st.w, 1, st.w) }
}

/// The count argument a player would make out loud: a line that still
/// needs as many tents as it has blanks left is all tents, and a line
/// that already has all of its tents is all grass. Relies on the passes
/// above having run out, which leaves every blank in the line a square
/// that really could hold a tent. Returns whether it fixed anything.
fn line_count_exact(st: &mut State, line: usize, rec: &mut Option<&mut Vec<Hint>>) -> bool {
    let (start, step, len) = line_span(st, line);
    let mut needed = st.numbers[line] as i32;
    let mut blanks = Vec::new();
    for j in 0..len {
        let pos = start + j * step;
        match st.grid[pos] {
            Square::Tent => needed -= 1,
            Square::Blank => blanks.push(pos),
            _ => {}
        }
    }
    if blanks.is_empty() {
        return false;
    }
    let (technique, sq) = if needed == 0 {
        (Technique::LineFull, Square::NonTent)
    } else if needed == blanks.len() as i32 {
        (Technique::LineExact, Square::Tent)
    } else {
        return false;
    };

    for &pos in &blanks {
        st.grid[pos] = sq;
    }
    record(rec, || Hint {
        technique,
        target: blanks.iter().map(|&pos| pos as u16).collect(),
        focus: (0..len).map(|j| (start + j * step) as u16).collect(),
        conclusions: blanks.iter().map(|&pos| (pos as u16, (sq == Square::Tent) as u8)).collect(),
    });
    true
}

/// One row or column of the count loop: enumerate every way of placing
/// the remaining tents in the line's blanks, drop those with two adjacent
/// tents, and fix any square (in the line, or for Tricky in the two
/// neighbouring lines) that every valid placement agrees on. `None` means
/// no placement was valid.
fn line_deduce(st: &mut State, tier: Tier, line: usize, rec: &mut Option<&mut Vec<Hint>>) -> Option<bool> {
    let (w, h) = (st.w, st.h);
    let (start, step, len) = line_span(st, line);
    let (mut start1, mut start2) = if line < w {
        ((line > 0).then(|| line - 1), (line + 1 < w).then(|| line + 1))
    } else {
        ((line > w).then(|| start - w), (line + 1 < w + h).then(|| start + w))
    };
    if tier != Tier::Tricky {
        start1 = None;
        start2 = None;
    }

    let mut k = st.numbers[line] as i32;
    let mut locs = Vec::with_capacity(len);
    for j in 0..len {
        match st.grid[start + j * step] {
            Square::Tent => k -= 1,
            Square::Blank => locs.push(j),
            _ => {}
        }
    }
    let n = locs.len();
    if n == 0 {
        return if k == 0 { Some(false) } else { None };
    }
    if k < 0 || k as usize > n {
        return None;
    }
    let k = k as usize;
    if combinations_exceed(n, k, MAX_LINE_COMBINATIONS) {
        return Some(false);
    }

    let mut place: Vec<bool> = (0..n).map(|j| j < k).collect();
    // None = Tatham's MAGIC: not set by any valid combination yet.
    let mut mrow: Vec<Option<Square>> = vec![None; 3 * len];
    let mut trow: Vec<Option<Square>> = vec![None; 3 * len];

    loop {
        let valid = !(0..n.saturating_sub(1)).any(|j| place[j] && place[j + 1] && locs[j + 1] == locs[j] + 1);
        if valid {
            trow[..len].fill(None);
            trow[len..].fill(Some(Square::Blank));
            for j in 0..n {
                trow[locs[j]] = Some(if place[j] { Square::Tent } else { Square::NonTent });
                if place[j] {
                    for jj in locs[j].saturating_sub(1)..=(locs[j] + 1).min(len - 1) {
                        trow[len + jj] = Some(Square::NonTent);
                        trow[2 * len + jj] = Some(Square::NonTent);
                    }
                }
            }
            for j in 0..3 * len {
                let Some(t) = trow[j] else {
                    continue;
                };
                mrow[j] = match mrow[j] {
                    None => Some(t),
                    Some(m) if m == t => Some(m),
                    Some(_) => Some(Square::Blank),
                };
            }
        }
        if !next_combination(&mut place) {
            break;
        }
    }

    mrow[locs[0]]?;

    let mut in_line = Vec::new();
    let mut beside = Vec::new();
    for j in 0..len {
        if let Some(sq) = mrow[j] {
            let pos = start + j * step;
            if sq != Square::Blank && st.grid[pos] == Square::Blank {
                st.grid[pos] = sq;
                in_line.push((pos as u16, (sq == Square::Tent) as u8));
            }
        }
        for (which, tstart) in [(1, start1), (2, start2)] {
            let (Some(tstart), Some(sq)) = (tstart, mrow[which * len + j]) else {
                continue;
            };
            let pos = tstart + j * step;
            if sq != Square::Blank && st.grid[pos] == Square::Blank {
                st.grid[pos] = sq;
                beside.push((pos as u16, 0));
            }
        }
    }

    let did = !in_line.is_empty() || !beside.is_empty();
    if did && rec.is_some() {
        // What the enumeration actually worked from: the squares of the
        // line that could still take a tent. Highlighting the whole line
        // buries them, and they are the handle the argument needs.
        let viable: Vec<u16> = locs.iter().map(|&j| (start + j * step) as u16).collect();
        if !in_line.is_empty() {
            record(rec, || Hint {
                technique: Technique::LineCount,
                target: in_line.iter().map(|&(c, _)| c).collect(),
                focus: viable.clone(),
                conclusions: in_line,
            });
        }
        if !beside.is_empty() {
            record(rec, || {
                let target: Vec<u16> = beside.iter().map(|&(c, _)| c).collect();
                let mut focus = viable;
                focus.extend(target.iter().copied());
                Hint {
                    technique: Technique::LineNeighbour,
                    target,
                    focus,
                    conclusions: beside,
                }
            });
        }
    }
    Some(did)
}

/// Exhaustive, independent solution count, capped. Assigns each tree a
/// distinct adjacent tent cell (most constrained tree first), keeping the
/// no-touching rule and the line counts, and counts distinct tent bitmaps
/// so a layout with several valid matchings is counted once. Shares
/// nothing with the technique solver.
pub(crate) fn count_solutions(d: &Description, cap: u32) -> u32 {
    let (w, h) = (d.width as usize, d.height as usize);
    let n = w * h;
    let trees: Vec<usize> = (0..n).filter(|&i| d.cells[i] == Cell::Tree).collect();
    let row_sum: usize = d.row_counts.iter().map(|&c| c as usize).sum();
    let col_sum: usize = d.column_counts.iter().map(|&c| c as usize).sum();
    if cap == 0 || row_sum != col_sum || row_sum != trees.len() {
        return 0;
    }

    let options: Vec<Vec<usize>> = trees
        .iter()
        .map(|&t| {
            Dir::ALL
                .into_iter()
                .filter_map(|dir| offset(w, h, t, dir.dx(), dir.dy()))
                .filter(|&j| d.cells[j] != Cell::Tree)
                .collect()
        })
        .collect();

    let mut search = Search {
        w,
        h,
        tent: vec![false; n],
        row_left: d.row_counts.iter().map(|&c| c as i32).collect(),
        col_left: d.column_counts.iter().map(|&c| c as i32).collect(),
        assigned: vec![false; trees.len()],
        options,
        found: Vec::new(),
        cap: cap as usize,
        budget: SearchBudget::default(),
        gave_up: false,
    };
    search.run(0);
    if search.gave_up {
        return cap;
    }
    search.found.len() as u32
}

struct Search {
    w: usize,
    h: usize,
    tent: Vec<bool>,
    row_left: Vec<i32>,
    col_left: Vec<i32>,
    assigned: Vec<bool>,
    options: Vec<Vec<usize>>,
    found: Vec<Vec<bool>>,
    cap: usize,
    /// The cap is on distinct tent bitmaps, and several tree-to-tent
    /// matchings can produce one bitmap: trees whose candidate cells form
    /// a cycle give exponentially many matchings and a single layout, so
    /// `found.len()` can sit at 1 while the search runs forever. The node
    /// budget is what actually stops that.
    budget: SearchBudget,
    /// Set when the search hit [`MAX_SEARCH_DEPTH`] or ran out of nodes
    /// and stopped. The layouts found so far are then a floor, not a
    /// count, so the caller reports the cap rather than a number it
    /// cannot stand behind.
    gave_up: bool,
}

impl Search {
    fn free(&self, cell: usize) -> bool {
        if self.tent[cell] || self.row_left[cell / self.w] == 0 || self.col_left[cell % self.w] == 0 {
            return false;
        }
        let (w, h) = (self.w, self.h);
        ![(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
            .into_iter()
            .filter_map(|(dx, dy)| offset(w, h, cell, dx, dy))
            .any(|j| self.tent[j])
    }

    fn run(&mut self, depth: u32) {
        if self.found.len() >= self.cap {
            return;
        }
        // One frame per tree, and a description from outside chooses how
        // many trees there are.
        if depth >= MAX_SEARCH_DEPTH || !self.budget.take() {
            self.gave_up = true;
            return;
        }
        let mut best: Option<(usize, Vec<usize>)> = None;
        for t in 0..self.options.len() {
            if self.assigned[t] {
                continue;
            }
            let free: Vec<usize> = self.options[t].iter().copied().filter(|&c| self.free(c)).collect();
            if free.is_empty() {
                return;
            }
            if best.as_ref().is_none_or(|(_, b)| free.len() < b.len()) {
                best = Some((t, free));
            }
        }
        let Some((t, free)) = best else {
            if self.row_left.iter().all(|&r| r == 0) && self.col_left.iter().all(|&c| c == 0) {
                let bitmap = self.tent.clone();
                if !self.found.contains(&bitmap) {
                    self.found.push(bitmap);
                }
            }
            return;
        };
        self.assigned[t] = true;
        for cell in free {
            self.tent[cell] = true;
            self.row_left[cell / self.w] -= 1;
            self.col_left[cell % self.w] -= 1;
            self.run(depth + 1);
            self.tent[cell] = false;
            self.row_left[cell / self.w] += 1;
            self.col_left[cell % self.w] += 1;
            if self.found.len() >= self.cap {
                break;
            }
        }
        self.assigned[t] = false;
    }
}

#[cfg(test)]
mod tests {
    use super::combinations_exceed;

    #[test]
    fn combination_counts_are_exact_up_to_the_cap() {
        assert!(!combinations_exceed(0, 0, 1));
        assert!(!combinations_exceed(32, 32, 1));
        assert!(!combinations_exceed(10, 5, 252));
        assert!(combinations_exceed(10, 5, 251));
        // C(32, 16) is 601080390: the count a 32-wide line of blanks with
        // half of them tents would enumerate, and the reason for the cap.
        assert!(combinations_exceed(32, 16, 200_000));
        assert!(!combinations_exceed(32, 16, 601_080_390));
        assert!(combinations_exceed(32, 16, 601_080_389));
    }
}
