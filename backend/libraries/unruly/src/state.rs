use crate::{Description, EMPTY, VALUE_A, VALUE_B};

/// Working grid. `grid` holds one byte per cell, row-major: 0 empty,
/// [`VALUE_A`] or [`VALUE_B`] otherwise. `w` and `h` are Tatham's `w2` and
/// `h2`, the full grid size; both are even, so each row holds `w / 2` of
/// each value and each column `h / 2`.
#[derive(Clone)]
pub(crate) struct State {
    pub w: usize,
    pub h: usize,
    pub grid: Vec<u8>,
}

/// Per-line tallies of each value, kept in step with the grid (Tatham's
/// `unruly_scratch`). Indexed `[value - 1]`.
#[derive(Clone)]
pub(crate) struct Counts {
    pub rows: [Vec<u8>; 2],
    pub cols: [Vec<u8>; 2],
}

impl State {
    pub fn new(w: usize, h: usize) -> Self {
        State {
            w,
            h,
            grid: vec![EMPTY; w * h],
        }
    }

    pub fn from_description(d: &Description) -> Self {
        State {
            w: d.width as usize,
            h: d.height as usize,
            grid: d.givens.clone(),
        }
    }

    pub fn size(&self) -> usize {
        self.w * self.h
    }

    /// How many of each value a row holds when complete.
    pub fn row_target(&self) -> u8 {
        (self.w / 2) as u8
    }

    /// How many of each value a column holds when complete.
    pub fn col_target(&self) -> u8 {
        (self.h / 2) as u8
    }

    /// Cell index of the `j`th cell of line `i`, along rows when
    /// `horizontal` and down columns otherwise.
    pub fn cell(&self, i: usize, j: usize, horizontal: bool) -> usize {
        if horizontal { i * self.w + j } else { j * self.w + i }
    }

    /// Number of lines in the given direction, and their length.
    pub fn lines(&self, horizontal: bool) -> (usize, usize) {
        if horizontal { (self.h, self.w) } else { (self.w, self.h) }
    }

    /// How many of each value a line in the given direction holds when
    /// complete.
    pub fn target(&self, horizontal: bool) -> u8 {
        if horizontal { self.row_target() } else { self.col_target() }
    }

    pub fn counts(&self) -> Counts {
        let mut c = Counts {
            rows: [vec![0; self.h], vec![0; self.h]],
            cols: [vec![0; self.w], vec![0; self.w]],
        };
        for (i, &v) in self.grid.iter().enumerate() {
            if v != EMPTY {
                c.rows[v as usize - 1][i / self.w] += 1;
                c.cols[v as usize - 1][i % self.w] += 1;
            }
        }
        c
    }

    pub fn filled(&self) -> bool {
        self.grid.iter().all(|&v| v != EMPTY)
    }

    /// Every run of three equal values, as (first cell, step, value) with
    /// the run being `first`, `first + step`, `first + 2 * step`.
    pub fn runs(&self) -> Vec<(usize, usize, u8)> {
        let mut out = Vec::new();
        for y in 0..self.h {
            for x in 0..self.w {
                let i = y * self.w + x;
                let v = self.grid[i];
                if v == EMPTY {
                    continue;
                }
                if x + 2 < self.w && self.grid[i + 1] == v && self.grid[i + 2] == v {
                    out.push((i, 1, v));
                }
                if y + 2 < self.h && self.grid[i + self.w] == v && self.grid[i + 2 * self.w] == v {
                    out.push((i, self.w, v));
                }
            }
        }
        out
    }

    /// True when no rule is broken yet: no run of three and no line
    /// holding more of a value than it is allowed. An unfinished grid can
    /// still be sound.
    pub fn sound(&self) -> bool {
        if !self.runs().is_empty() {
            return false;
        }
        let c = self.counts();
        for v in [VALUE_A, VALUE_B] {
            let c = &c.rows[v as usize - 1];
            if c.iter().any(|&n| n > self.row_target()) {
                return false;
            }
        }
        for v in [VALUE_A, VALUE_B] {
            let c = &c.cols[v as usize - 1];
            if c.iter().any(|&n| n > self.col_target()) {
                return false;
            }
        }
        true
    }
}

/// The value that is not `v`.
pub(crate) fn other(v: u8) -> u8 {
    if v == VALUE_A { VALUE_B } else { VALUE_A }
}
