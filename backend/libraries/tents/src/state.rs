use crate::{Cell, Description};

/// One square of the working grid, the port of Tatham's BLANK / TREE /
/// TENT / NONTENT.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Square {
    Blank,
    Tree,
    Tent,
    NonTent,
}

/// Link directions in Tatham's order: up, left, right, down.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Dir {
    Up,
    Left,
    Right,
    Down,
}

impl Dir {
    pub const ALL: [Dir; 4] = [Dir::Up, Dir::Left, Dir::Right, Dir::Down];

    pub fn flip(self) -> Dir {
        match self {
            Dir::Up => Dir::Down,
            Dir::Down => Dir::Up,
            Dir::Left => Dir::Right,
            Dir::Right => Dir::Left,
        }
    }

    pub fn dx(self) -> i32 {
        match self {
            Dir::Left => -1,
            Dir::Right => 1,
            _ => 0,
        }
    }

    pub fn dy(self) -> i32 {
        match self {
            Dir::Up => -1,
            Dir::Down => 1,
            _ => 0,
        }
    }

    pub fn horizontal(self) -> bool {
        matches!(self, Dir::Left | Dir::Right)
    }
}

/// Working grid: the puzzle squares plus the solver's tree/tent links
/// (Tatham's `soln` and `solver_scratch.links`).
#[derive(Clone)]
pub(crate) struct State {
    pub w: usize,
    pub h: usize,
    pub grid: Vec<Square>,
    /// Column counts then row counts, Tatham's `numbers` layout.
    pub numbers: Vec<u8>,
    pub links: Vec<Option<Dir>>,
}

impl State {
    pub fn new(w: usize, h: usize) -> Self {
        let n = w * h;
        State {
            w,
            h,
            grid: vec![Square::Blank; n],
            numbers: vec![0; w + h],
            links: vec![None; n],
        }
    }

    pub fn from_description(d: &Description) -> Self {
        let mut s = State::new(d.width as usize, d.height as usize);
        for (i, cell) in d.cells.iter().enumerate() {
            if *cell == Cell::Tree {
                s.grid[i] = Square::Tree;
            }
        }
        s.numbers[..s.w].copy_from_slice(&d.column_counts);
        s.numbers[s.w..].copy_from_slice(&d.row_counts);
        s
    }

    pub fn size(&self) -> usize {
        self.w * self.h
    }

    /// The square one step from `i` in direction `d`, if it is on the grid.
    pub fn step(&self, i: usize, d: Dir) -> Option<usize> {
        offset(self.w, self.h, i, d.dx(), d.dy())
    }

    /// Orthogonal neighbours in Tatham's direction order: up, left, right,
    /// down.
    pub fn neighbours(&self, i: usize) -> impl Iterator<Item = (Dir, usize)> + '_ {
        Dir::ALL.into_iter().filter_map(move |d| self.step(i, d).map(|j| (d, j)))
    }

    /// The eight surrounding squares, row by row, as Tatham's dy/dx loops
    /// visit them.
    pub fn around(&self, i: usize) -> impl Iterator<Item = usize> + '_ {
        [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
            .into_iter()
            .filter_map(move |(dx, dy)| offset(self.w, self.h, i, dx, dy))
    }

    pub fn tents(&self) -> Vec<u8> {
        self.grid.iter().map(|&s| (s == Square::Tent) as u8).collect()
    }
}

pub(crate) fn offset(w: usize, h: usize, i: usize, dx: i32, dy: i32) -> Option<usize> {
    let x = (i % w) as i32 + dx;
    let y = (i / w) as i32 + dy;
    (x >= 0 && x < w as i32 && y >= 0 && y < h as i32).then(|| y as usize * w + x as usize)
}
