use crate::state::{Counts, State, other};
use crate::{EMPTY, Hint, Technique, Tier, VALUE_A, VALUE_B};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Solved,
    /// A rule is already broken, so nothing can be salvaged.
    Invalid,
    /// Techniques exhausted with cells still empty.
    Stuck,
}

struct Solver<'a, 'b> {
    counts: Counts,
    rec: &'a mut Option<&'b mut Vec<Hint>>,
}

impl Solver<'_, '_> {
    fn count(&self, horizontal: bool, value: u8, line: usize) -> i32 {
        let c = if horizontal { &self.counts.rows } else { &self.counts.cols };
        c[value as usize - 1][line] as i32
    }

    fn fill(&mut self, st: &mut State, i: usize, v: u8) {
        st.grid[i] = v;
        self.counts.rows[v as usize - 1][i / st.w] += 1;
        self.counts.cols[v as usize - 1][i % st.w] += 1;
    }

    fn push(&mut self, technique: Technique, focus: Vec<u16>, target: Vec<u16>, conclusions: Vec<(u16, u8)>) {
        if let Some(rec) = self.rec.as_mut() {
            debug_assert!(!target.is_empty() && target.iter().all(|t| focus.contains(t)));
            rec.push(Hint {
                technique,
                focus,
                target,
                conclusions,
            });
        }
    }

    /// Port of `unruly_solver_fill_row`: put `fill` in every empty cell of
    /// line `i` other than the excluded ones. Returns the conclusions.
    fn fill_line(&mut self, st: &mut State, i: usize, horizontal: bool, fill: u8, exclude: &[usize]) -> Vec<(u16, u8)> {
        let (_, len) = st.lines(horizontal);
        let mut out = Vec::new();
        for j in 0..len {
            let p = st.cell(i, j, horizontal);
            if st.grid[p] == EMPTY && !exclude.contains(&p) {
                self.fill(st, p, fill);
                out.push((p as u16, fill));
            }
        }
        out
    }

    /// Port of `unruly_solver_check_threes`: a pair of equal values with a
    /// third cell of the window empty forces the other value there.
    fn check_threes(&mut self, st: &mut State, horizontal: bool, check: u8) -> usize {
        let block = other(check);
        let (w, h) = (st.w, st.h);
        let (dx, dy) = if horizontal { (1, 0) } else { (0, 1) };
        let mut ret = 0;
        for y in dy..h - dy {
            for x in dx..w - dx {
                let i1 = (y - dy) * w + (x - dx);
                let i2 = y * w + x;
                let i3 = (y + dy) * w + (x + dx);
                let (g1, g2, g3) = (st.grid[i1], st.grid[i2], st.grid[i3]);
                let focus = vec![i1 as u16, i2 as u16, i3 as u16];
                if g1 == check && g2 == check && g3 == EMPTY {
                    self.fill(st, i3, block);
                    self.push(
                        Technique::PairEnd,
                        focus,
                        vec![i1 as u16, i2 as u16],
                        vec![(i3 as u16, block)],
                    );
                    ret += 1;
                } else if g1 == check && g2 == EMPTY && g3 == check {
                    self.fill(st, i2, block);
                    self.push(
                        Technique::PairGap,
                        focus,
                        vec![i1 as u16, i3 as u16],
                        vec![(i2 as u16, block)],
                    );
                    ret += 1;
                } else if g1 == EMPTY && g2 == check && g3 == check {
                    self.fill(st, i1, block);
                    self.push(
                        Technique::PairEnd,
                        focus,
                        vec![i2 as u16, i3 as u16],
                        vec![(i1 as u16, block)],
                    );
                    ret += 1;
                }
            }
        }
        ret
    }

    /// Port of `unruly_solver_check_single_gap`: a line with all of one
    /// value and one cell short of the other has a single empty cell.
    fn check_single_gap(&mut self, st: &mut State, horizontal: bool, complete: u8) -> usize {
        let fill = other(complete);
        let (n, _) = st.lines(horizontal);
        let target = st.target(horizontal) as i32;
        let mut ret = 0;
        for i in 0..n {
            if self.count(horizontal, complete, i) != target || self.count(horizontal, fill, i) != target - 1 {
                continue;
            }
            let conclusions = self.fill_line(st, i, horizontal, fill, &[]);
            if !conclusions.is_empty() {
                let target_cells = conclusions.iter().map(|&(k, _)| k).collect();
                self.push(Technique::LastGap, line_cells(st, i, horizontal), target_cells, conclusions);
                ret += 1;
            }
        }
        ret
    }

    /// Port of `unruly_solver_check_complete_nums`: a line that already has
    /// all the cells it is allowed of one value takes the other value
    /// everywhere else.
    fn check_complete_nums(&mut self, st: &mut State, horizontal: bool, complete: u8) -> usize {
        let fill = other(complete);
        let (n, _) = st.lines(horizontal);
        let target = st.target(horizontal) as i32;
        let mut ret = 0;
        for i in 0..n {
            if self.count(horizontal, complete, i) != target || self.count(horizontal, fill, i) >= target {
                continue;
            }
            let focus = line_cells(st, i, horizontal);
            let target_cells = focus.iter().copied().filter(|&k| st.grid[k as usize] == complete).collect();
            let conclusions = self.fill_line(st, i, horizontal, fill, &[]);
            if !conclusions.is_empty() {
                self.push(Technique::LineFull, focus, target_cells, conclusions);
                ret += 1;
            }
        }
        ret
    }

    /// Port of `unruly_solver_check_near_complete`: a line needing exactly
    /// one more of a value, where a window of three would otherwise become
    /// three of the other value in a row, must spend that last one inside
    /// the window, so every empty cell outside it takes the other value.
    fn check_near_complete(&mut self, st: &mut State, horizontal: bool, complete: u8) -> usize {
        let fill = other(complete);
        let (w, h) = (st.w, st.h);
        let (dx, dy) = if horizontal { (1, 0) } else { (0, 1) };
        let target = st.target(horizontal) as i32;
        let mut ret = 0;
        for y in dy..h - dy {
            for x in dx..w - dx {
                let line = if horizontal { y } else { x };
                // One value must have exactly one cell left to place, the
                // other at least two.
                if self.count(horizontal, complete, line) < target - 1 || self.count(horizontal, fill, line) > target - 2 {
                    continue;
                }
                let i1 = (y - dy) * w + (x - dx);
                let i2 = y * w + x;
                let i3 = (y + dy) * w + (x + dx);
                let (g1, g2, g3) = (st.grid[i1], st.grid[i2], st.grid[i3]);
                let exclude = if g1 == fill && g2 == EMPTY && g3 == EMPTY {
                    vec![i2, i3]
                } else if g1 == EMPTY && g2 == fill && g3 == EMPTY {
                    vec![i1, i3]
                } else if g1 == EMPTY && g2 == EMPTY && g3 == fill {
                    vec![i1, i2]
                } else if g1 == EMPTY && g2 == EMPTY && g3 == EMPTY {
                    vec![i1, i2, i3]
                } else {
                    continue;
                };
                let conclusions = self.fill_line(st, line, horizontal, fill, &exclude);
                if !conclusions.is_empty() {
                    self.push(
                        Technique::LastInRun,
                        line_cells(st, line, horizontal),
                        vec![i1 as u16, i2 as u16, i3 as u16],
                        conclusions,
                    );
                    ret += 1;
                }
            }
        }
        ret
    }
}

fn line_cells(st: &State, i: usize, horizontal: bool) -> Vec<u16> {
    let (_, len) = st.lines(horizontal);
    (0..len).map(|j| st.cell(i, j, horizontal) as u16).collect()
}

/// Port of `unruly_solve_game`: run the technique passes to a fixed point,
/// cheapest first, restarting from the top whenever one of them fires.
/// Continues from whatever is already in `st.grid`; never guesses.
pub(crate) fn solve(st: &mut State, tier: Tier, mut rec: Option<&mut Vec<Hint>>) -> Outcome {
    let mut s = Solver {
        counts: st.counts(),
        rec: &mut rec,
    };

    loop {
        let mut done = 0;
        for (horizontal, check) in [(true, VALUE_A), (true, VALUE_B), (false, VALUE_A), (false, VALUE_B)] {
            done += s.check_threes(st, horizontal, check);
        }
        if done > 0 {
            continue;
        }

        for (horizontal, complete) in [(true, VALUE_A), (false, VALUE_A), (true, VALUE_B), (false, VALUE_B)] {
            done += s.check_single_gap(st, horizontal, complete);
        }
        if done > 0 {
            continue;
        }

        for (horizontal, complete) in [(true, VALUE_A), (false, VALUE_A), (true, VALUE_B), (false, VALUE_B)] {
            done += s.check_complete_nums(st, horizontal, complete);
        }
        if done > 0 {
            continue;
        }

        if tier != Tier::Tricky {
            break;
        }

        for (horizontal, complete) in [(true, VALUE_A), (false, VALUE_A), (true, VALUE_B), (false, VALUE_B)] {
            done += s.check_near_complete(st, horizontal, complete);
        }
        if done == 0 {
            break;
        }
    }

    if !st.sound() {
        Outcome::Invalid
    } else if st.filled() {
        Outcome::Solved
    } else {
        Outcome::Stuck
    }
}

/// Can `v` go in cell `i` without making three in a row or pushing a line
/// over its quota?
fn feasible(st: &State, grid: &[u8], counts: &Counts, i: usize, v: u8) -> bool {
    let (w, h) = (st.w, st.h);
    let (x, y) = (i % w, i / w);
    if counts.rows[v as usize - 1][y] >= st.row_target() || counts.cols[v as usize - 1][x] >= st.col_target() {
        return false;
    }
    let at = |cx: isize, cy: isize| -> u8 {
        if cx < 0 || cy < 0 || cx >= w as isize || cy >= h as isize {
            EMPTY
        } else {
            let p = cy as usize * w + cx as usize;
            if p == i { v } else { grid[p] }
        }
    };
    for (dx, dy) in [(1isize, 0isize), (0, 1)] {
        for k in -2isize..=0 {
            let (ax, ay) = (x as isize + dx * k, y as isize + dy * k);
            if at(ax, ay) == v && at(ax + dx, ay + dy) == v && at(ax + 2 * dx, ay + 2 * dy) == v {
                return false;
            }
        }
    }
    true
}

/// Exhaustive solution count, capped. Independent of the technique solver:
/// a cell with one feasible value takes it, a cell with none kills the
/// branch, and otherwise it branches on the first undecided cell.
pub(crate) fn count_solutions(st: &State, cap: u32) -> u32 {
    if !st.sound() {
        return 0;
    }
    let grid = st.grid.clone();
    let counts = st.counts();
    count_rec(st, grid, counts, cap)
}

fn set(st: &State, grid: &mut [u8], counts: &mut Counts, i: usize, v: u8) {
    grid[i] = v;
    counts.rows[v as usize - 1][i / st.w] += 1;
    counts.cols[v as usize - 1][i % st.w] += 1;
}

fn count_rec(st: &State, mut grid: Vec<u8>, mut counts: Counts, cap: u32) -> u32 {
    if cap == 0 {
        return 0;
    }
    let branch = loop {
        let mut changed = false;
        let mut branch = None;
        for i in 0..st.size() {
            if grid[i] != EMPTY {
                continue;
            }
            let a = feasible(st, &grid, &counts, i, VALUE_A);
            let b = feasible(st, &grid, &counts, i, VALUE_B);
            match (a, b) {
                (false, false) => return 0,
                (true, true) => {
                    if branch.is_none() {
                        branch = Some(i);
                    }
                }
                (a, _) => {
                    set(st, &mut grid, &mut counts, i, if a { VALUE_A } else { VALUE_B });
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
    for v in [VALUE_A, VALUE_B] {
        let mut g = grid.clone();
        let mut c = counts.clone();
        set(st, &mut g, &mut c, i, v);
        total += count_rec(st, g, c, cap - total);
        if total >= cap {
            return cap;
        }
    }
    total
}
