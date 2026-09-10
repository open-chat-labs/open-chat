//! Light Up (Akari) puzzle generator, technique solver and rule checker.
//!
//! The generator and solver are a port of `lightup.c` from Simon Tatham's
//! Portable Puzzle Collection, minus the recursive (guessing) tier.
//!
//! lightup.c is copyright (c) 2004-2024 Simon Tatham and contributors and
//! is used under the MIT licence:
//!
//! Permission is hereby granted, free of charge, to any person obtaining a
//! copy of this software and associated documentation files (the
//! "Software"), to deal in the Software without restriction, including
//! without limitation the rights to use, copy, modify, merge, publish,
//! distribute, sublicense, and/or sell copies of the Software, and to permit
//! persons to whom the Software is furnished to do so, subject to the
//! following conditions:
//!
//! The above copyright notice and this permission notice shall be included
//! in all copies or substantial portions of the Software.
//!
//! THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
//! OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//! MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//! IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//! CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//! TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//! SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//!
//! # Wire encodings
//!
//! Description: byte 0 = format version (1), byte 1 = width, byte 2 =
//! height, then width*height cell bytes in row-major order: 0x00 = white,
//! 0x10 = black unnumbered, 0x11..=0x15 = black with clue 0..=4.
//!
//! Solution / grid: width*height bytes row-major, 0 = no bulb, 1 = bulb.

mod generate;
mod rng;
mod solver;
mod state;

use state::State;

pub const GAME_ID: &str = "light_up";

const FORMAT_VERSION: u8 = 1;
const CELL_WHITE: u8 = 0x00;
const CELL_BLACK: u8 = 0x10;
const CELL_CLUE_BASE: u8 = 0x11;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Easy = 0,
    Tricky = 1,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Symmetry {
    None,
    Rot2,
    Rot4,
    Ref2,
    Ref4,
}

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub width: u8,
    pub height: u8,
    pub black_pct: u8,
    pub symmetry: Symmetry,
    pub tier: Tier,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    OnlyOneWayToLight = 1,
    ClueSatisfied = 2,
    ClueForced = 3,
    SetExclusion = 4,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hint {
    pub technique: Technique,
    /// Cell indices (y*width+x) to highlight: the clue and/or the cells the
    /// deduction looked at.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at ("this cell", "this number"): a subset of
    /// `focus`, painted strongly by the client while the rest of `focus` is context.
    pub target: Vec<u16>,
    /// (cell index, value) where value 1 = bulb, 0 = no bulb.
    pub conclusions: Vec<(u16, u8)>,
}

#[derive(Clone, Debug)]
pub struct Generated {
    pub description: Vec<u8>,
    pub solution: Vec<u8>,
    /// The solver's deduction trace from the empty grid, in order.
    pub hints: Vec<Hint>,
    /// The solution in hint-key space: see [`solution_pairs`].
    pub pairs: Vec<(u16, u8)>,
    pub tier: Tier,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    White,
    Black(Option<u8>),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Description {
    pub width: u8,
    pub height: u8,
    pub cells: Vec<Cell>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    BulbSeesBulb { a: u16, b: u16 },
    ClueCount { clue: u16, expected: u8, actual: u8 },
    Unlit { cell: u16 },
    BulbOnBlack { cell: u16 },
}

/// Deterministic: the same seed and params always give the same bytes.
/// Panics if width or height is below 2 or black_pct is outside 5..=100.
/// Rot4 on a non-square grid falls back to Rot2, as Tatham does.
pub fn generate(seed: u64, params: Params) -> Generated {
    generate::generate(seed, params)
}

/// Rule check used by tests and mirrored by the client. `grid` is w*h
/// bytes, 1 = bulb, 0 = no bulb. A grid of the wrong length is treated as
/// having no bulbs at all. Panics on a malformed description.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Vec<Violation> {
    let d = parse_description(description).expect("malformed description");
    let (w, h) = (d.width as usize, d.height as usize);
    let n = w * h;
    let bulb = |i: usize| grid.len() == n && grid[i] != 0;
    let black = |i: usize| matches!(d.cells[i], Cell::Black(_));
    let mut out = Vec::new();
    let mut lit = vec![false; n];

    for i in 0..n {
        if !bulb(i) {
            continue;
        }
        if black(i) {
            out.push(Violation::BulbOnBlack { cell: i as u16 });
            continue;
        }
        lit[i] = true;
        let (x, y) = (i % w, i / w);
        // Scan right and down so each pair is reported once, with a < b.
        for (dx, dy) in [(1usize, 0usize), (0, 1)] {
            let (mut cx, mut cy) = (x + dx, y + dy);
            while cx < w && cy < h && !black(cy * w + cx) {
                let j = cy * w + cx;
                lit[j] = true;
                if bulb(j) {
                    out.push(Violation::BulbSeesBulb {
                        a: i as u16,
                        b: j as u16,
                    });
                }
                cx += dx;
                cy += dy;
            }
        }
        for (dx, dy) in [(1usize, 0usize), (0, 1)] {
            let (mut cx, mut cy) = (x, y);
            while cx >= dx && cy >= dy {
                cx -= dx;
                cy -= dy;
                let j = cy * w + cx;
                if black(j) {
                    break;
                }
                lit[j] = true;
            }
        }
    }

    for (i, cell) in d.cells.iter().enumerate() {
        match *cell {
            Cell::White => {
                if !lit[i] {
                    out.push(Violation::Unlit { cell: i as u16 });
                }
            }
            Cell::Black(Some(expected)) => {
                let actual = neighbours(w, h, i).filter(|&j| bulb(j)).count() as u8;
                if actual != expected {
                    out.push(Violation::ClueCount {
                        clue: i as u16,
                        expected,
                        actual,
                    });
                }
            }
            Cell::Black(None) => {}
        }
    }
    out
}

fn neighbours(w: usize, h: usize, i: usize) -> impl Iterator<Item = usize> {
    let x = i % w;
    [
        (x > 0).then(|| i - 1),
        (x + 1 < w).then(|| i + 1),
        (i >= w).then(|| i - w),
        (i + w < w * h).then(|| i + w),
    ]
    .into_iter()
    .flatten()
}

/// The solution in hint-key space: `(cell index, 1 = bulb / 0 = no bulb)`
/// for every white cell, sorted by cell. Same keys and values as hint
/// conclusions. A solution of the wrong length counts as having no
/// bulbs. Panics on a malformed description.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Vec<(u16, u8)> {
    let d = parse_description(description).expect("malformed description");
    let n = d.cells.len();
    d.cells
        .iter()
        .enumerate()
        .filter(|(_, c)| **c == Cell::White)
        .map(|(i, _)| (i as u16, (solution.len() == n && solution[i] != 0) as u8))
        .collect()
}

/// Number of solutions, capped at `cap`, via backtracking. Returns 0 for a
/// malformed description.
pub fn count_solutions(description: &[u8], cap: u32) -> u32 {
    let Ok(d) = parse_description(description) else {
        return 0;
    };
    let mut st = State::from_description(&d);
    solver::count_solutions(&mut st, cap)
}

/// Technique solver from the empty grid; returns the trace and the
/// solution if it was reached without guessing.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> (Vec<Hint>, Option<Vec<u8>>) {
    let Ok(d) = parse_description(description) else {
        return (Vec::new(), None);
    };
    let mut st = State::from_description(&d);
    let mut hints = Vec::new();
    let solution = match solver::solve(&mut st, tier, Some(&mut hints)) {
        solver::Outcome::Solved => Some(st.light.iter().map(|&b| b as u8).collect()),
        _ => None,
    };
    (hints, solution)
}

pub fn parse_description(bytes: &[u8]) -> Result<Description, String> {
    if bytes.len() < 3 {
        return Err("description too short".to_string());
    }
    if bytes[0] != FORMAT_VERSION {
        return Err(format!("unsupported format version {}", bytes[0]));
    }
    let (width, height) = (bytes[1], bytes[2]);
    let expected = 3 + width as usize * height as usize;
    if bytes.len() != expected {
        return Err(format!("expected {expected} bytes, got {}", bytes.len()));
    }
    let cells = bytes[3..]
        .iter()
        .map(|&b| match b {
            CELL_WHITE => Ok(Cell::White),
            CELL_BLACK => Ok(Cell::Black(None)),
            CELL_CLUE_BASE..=0x15 => Ok(Cell::Black(Some(b - CELL_CLUE_BASE))),
            _ => Err(format!("bad cell byte 0x{b:02x}")),
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Description { width, height, cells })
}

pub(crate) fn encode_description(st: &State) -> Vec<u8> {
    let mut out = Vec::with_capacity(3 + st.size());
    out.push(FORMAT_VERSION);
    out.push(st.w as u8);
    out.push(st.h as u8);
    for i in 0..st.size() {
        out.push(match (st.black[i], st.clue[i]) {
            (false, _) => CELL_WHITE,
            (true, None) => CELL_BLACK,
            (true, Some(n)) => CELL_CLUE_BASE + n,
        });
    }
    out
}

/// One line per row: `#` black, digit = clue, `.` white. With a grid,
/// `O` = bulb and `+` = lit white cell.
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> String {
    let Ok(d) = parse_description(description) else {
        return String::new();
    };
    let (w, h) = (d.width as usize, d.height as usize);
    let mut st = State::from_description(&d);
    if let Some(g) = grid {
        for (i, &b) in g.iter().enumerate().take(st.size()) {
            if b != 0 && !st.black[i] {
                st.set_light(i, true);
            }
        }
    }
    let mut out = String::with_capacity((w + 1) * h);
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            out.push(match d.cells[i] {
                Cell::Black(Some(n)) => (b'0' + n) as char,
                Cell::Black(None) => '#',
                Cell::White if st.light[i] => 'O',
                Cell::White if st.lit[i] > 0 => '+',
                Cell::White => '.',
            });
        }
        out.push('\n');
    }
    out
}
