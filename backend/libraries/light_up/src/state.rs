use crate::{Cell, Description};

/// Working grid, the port of Tatham's `game_state`. Black cells carry an
/// optional clue; white cells carry a bulb flag, an "impossible" flag and
/// the number of bulbs currently lighting them (a bulb lights itself).
#[derive(Clone)]
pub(crate) struct State {
    pub w: usize,
    pub h: usize,
    pub black: Vec<bool>,
    pub clue: Vec<Option<u8>>,
    /// Set when a clue drove a basic deduction (Tatham's F_NUMBERUSED).
    pub clue_used: Vec<bool>,
    pub light: Vec<bool>,
    pub impossible: Vec<bool>,
    pub lit: Vec<u16>,
}

/// Line of sight from a cell: the row span and column span not blocked by
/// black cells (Tatham's `ll_data`).
pub(crate) struct Los {
    w: usize,
    ox: usize,
    oy: usize,
    minx: usize,
    maxx: usize,
    miny: usize,
    maxy: usize,
    include_origin: bool,
}

impl Los {
    /// Row cells (excluding the origin) then column cells, matching
    /// Tatham's FOREACHLIT order.
    pub fn cells(&self) -> impl Iterator<Item = usize> + '_ {
        let (w, ox, oy, inc) = (self.w, self.ox, self.oy, self.include_origin);
        (self.minx..=self.maxx)
            .filter(move |&x| x != ox)
            .map(move |x| oy * w + x)
            .chain(
                (self.miny..=self.maxy)
                    .filter(move |&y| inc || y != oy)
                    .map(move |y| y * w + ox),
            )
    }
}

impl State {
    pub fn new(w: usize, h: usize) -> Self {
        let n = w * h;
        State {
            w,
            h,
            black: vec![false; n],
            clue: vec![None; n],
            clue_used: vec![false; n],
            light: vec![false; n],
            impossible: vec![false; n],
            lit: vec![0; n],
        }
    }

    pub fn from_description(d: &Description) -> Self {
        let mut s = State::new(d.width as usize, d.height as usize);
        for (i, cell) in d.cells.iter().enumerate() {
            if let Cell::Black(clue) = cell {
                s.black[i] = true;
                s.clue[i] = *clue;
            }
        }
        s
    }

    pub fn size(&self) -> usize {
        self.w * self.h
    }

    /// Orthogonal neighbours in Tatham's `get_surrounds` order:
    /// left, right, up, down.
    pub fn neighbours(&self, i: usize) -> impl Iterator<Item = usize> {
        puzzle_core::neighbours(self.w, self.h, i)
    }

    /// Port of `list_lights`.
    pub fn los(&self, i: usize, include_origin: bool) -> Los {
        let w = self.w;
        let (ox, oy) = (i % w, i / w);
        let mut l = Los {
            w,
            ox,
            oy,
            minx: ox,
            maxx: ox,
            miny: oy,
            maxy: oy,
            include_origin,
        };
        while l.minx > 0 && !self.black[oy * w + l.minx - 1] {
            l.minx -= 1;
        }
        while l.maxx + 1 < w && !self.black[oy * w + l.maxx + 1] {
            l.maxx += 1;
        }
        while l.miny > 0 && !self.black[(l.miny - 1) * w + ox] {
            l.miny -= 1;
        }
        while l.maxy + 1 < self.h && !self.black[(l.maxy + 1) * w + ox] {
            l.maxy += 1;
        }
        l
    }

    pub fn could_place(&self, i: usize) -> bool {
        !self.black[i] && !self.impossible[i] && self.lit[i] == 0
    }

    /// Port of `set_light`: toggles a bulb and updates the lit counts along
    /// its line of sight.
    pub fn set_light(&mut self, i: usize, on: bool) {
        debug_assert!(!self.black[i]);
        if self.light[i] == on {
            return;
        }
        self.light[i] = on;
        let los = self.los(i, true);
        for c in los.cells() {
            if on {
                self.lit[c] += 1;
            } else {
                self.lit[c] -= 1;
            }
        }
    }

    pub fn lit_neighbours(&self, i: usize) -> u8 {
        self.neighbours(i).filter(|&n| self.light[n]).count() as u8
    }

    pub fn grid_lit(&self) -> bool {
        (0..self.size()).all(|i| self.black[i] || self.lit[i] > 0)
    }

    pub fn grid_overlap(&self) -> bool {
        (0..self.size()).any(|i| self.light[i] && self.lit[i] > 1)
    }

    pub fn grid_adds_up(&self) -> bool {
        (0..self.size()).all(|i| match self.clue[i] {
            Some(n) => self.lit_neighbours(i) == n,
            None => true,
        })
    }

    pub fn grid_correct(&self) -> bool {
        self.grid_lit() && !self.grid_overlap() && self.grid_adds_up()
    }

    /// Port of `unplace_lights`: back to the bare puzzle.
    pub fn unplace_lights(&mut self) {
        for i in 0..self.size() {
            if self.light[i] {
                self.set_light(i, false);
            }
            self.impossible[i] = false;
            self.clue_used[i] = false;
        }
    }
}
