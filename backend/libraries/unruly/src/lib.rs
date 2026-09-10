//! Unruly (Binary Puzzle / Binairo) generator, technique solver and rule
//! checker.
//!
//! Fill every cell with one of two values so that no three cells in a row
//! or column hold the same value, and every row and every column holds
//! equally many of each value. Width and height are therefore both even.
//!
//! The generator and solver are a port of `unruly.c` from Simon Tatham's
//! Portable Puzzle Collection. Tatham's ladder is Trivial / Easy / Normal,
//! with recursion reserved for an 'Unreasonable' level he never wrote, so
//! nothing below is a guess. `Tier::Easy` is his DIFF_EASY and
//! `Tier::Tricky` his DIFF_NORMAL; DIFF_TRIVIAL is not exposed, because its
//! two techniques are pure pattern-spotting with no counting and Tatham
//! himself skips the "did this come out too easy" check for it. His
//! optional "unique rows and columns" variant is not ported.
//!
//! unruly.c is copyright (c) 2012 Lennard Sprong and is used under the
//! MIT licence:
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
//! height, then width*height given bytes in row-major order: 0 = blank,
//! 1 = the first value, 2 = the second value.
//!
//! Solution / grid: width*height cell bytes row-major, each 1 or 2. A
//! grid may hold 0 for an empty cell; a solution never does.
//!
//! Hint keys are cell indices (y*width+x) and conclusion values are 1 or
//! 2. Unlike the other games there is no "empty" conclusion: every
//! deduction fills a cell in. `target` is the non-empty subset of `focus`
//! that the technique's sentence points at; the rest of `focus` is the
//! context the deduction read.
//!
//! # Techniques
//!
//! | id | name | target | explanation |
//! |----|------|--------|-------------|
//! | 1 | PairEnd | the two matching cells | These two neighbours already hold the same value, so the cell just past them must hold the other one: three the same in a row is never allowed. |
//! | 2 | PairGap | the two matching cells | These two cells hold the same value one apart, so the cell between them must hold the other one: three the same in a row is never allowed. |
//! | 3 | LastGap | the empty cell | This line has all the cells it is allowed of one value and is one short of the other, so its last empty cell must hold that other value. |
//! | 4 | LineFull | the cells of the finished value | This line already holds as many of this value as it is allowed, so every cell still empty in the line must hold the other value. |
//! | 5 | LastInRun | the run of three | This line needs exactly one more of one value, and putting it outside these three cells would leave three of the other value in a row here, so every empty cell elsewhere in the line takes the other value. |
//!
//! Easy uses 1-4 (Tatham's DIFF_EASY: check_threes, check_single_gap and
//! check_complete_nums). Tricky adds 5 (DIFF_NORMAL:
//! check_near_complete).

mod generate;
mod rng;
mod solver;
mod state;

use state::State;

pub const GAME_ID: &str = "unruly";

const FORMAT_VERSION: u8 = 1;
/// An undecided cell. Never appears in a solution.
pub const EMPTY: u8 = 0;
pub const VALUE_A: u8 = 1;
pub const VALUE_B: u8 = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Easy = 0,
    Tricky = 1,
}

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub width: u8,
    pub height: u8,
    pub tier: Tier,
}

impl Params {
    /// Unruly has no density knobs; Tatham's generator takes only the size
    /// and difficulty, and strips givens until the solver just copes.
    pub fn default_for(width: u8, height: u8, tier: Tier) -> Params {
        Params { width, height, tier }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    PairEnd = 1,
    PairGap = 2,
    LastGap = 3,
    LineFull = 4,
    LastInRun = 5,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hint {
    pub technique: Technique,
    /// Cell indices (y*width+x) the deduction looked at.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at ("this cell", "this run"):
    /// a non-empty subset of `focus`, painted strongly by the client while
    /// the rest of `focus` is context.
    pub target: Vec<u16>,
    /// (cell index, value) where value is 1 or 2.
    pub conclusions: Vec<(u16, u8)>,
}

#[derive(Clone, Debug)]
pub struct Generated {
    pub description: Vec<u8>,
    pub solution: Vec<u8>,
    /// The solver's deduction trace from the givens, in order.
    pub hints: Vec<Hint>,
    /// The solution in hint-key space: see [`solution_pairs`].
    pub pairs: Vec<(u16, u8)>,
    pub tier: Tier,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Description {
    pub width: u8,
    pub height: u8,
    /// width*height cells, row-major: 0 = blank, 1 or 2 = a given.
    pub givens: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    /// Three equal values in a row, listed left to right or top to bottom.
    Run { cells: Vec<u16>, value: u8 },
    /// This row holds more of `value` than the width/2 it is allowed.
    RowCount { row: u16, value: u8, count: u8 },
    /// This column holds more of `value` than the height/2 it is allowed.
    ColumnCount { column: u16, value: u8, count: u8 },
}

/// Deterministic: the same seed and params always give the same bytes.
/// Panics if width or height is odd or below 6, Tatham's minimum.
pub fn generate(seed: u64, params: Params) -> Generated {
    generate::generate(seed, params)
}

/// Rule check used by tests and mirrored by the client. `grid` is w*h
/// bytes, 1 or 2, anything else = empty. A grid of the wrong length is
/// treated as empty. Empty cells are not violations (the grid is merely
/// incomplete), and nor is a line that is short of a value: only a line
/// with too many of one is wrong. Panics on a malformed description.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Vec<Violation> {
    let d = parse_description(description).expect("malformed description");
    let mut st = State::from_description(&d);
    if grid.len() == st.size() {
        for (i, &b) in grid.iter().enumerate() {
            st.grid[i] = if b == VALUE_A || b == VALUE_B { b } else { EMPTY };
        }
    } else {
        st.grid.fill(EMPTY);
    }

    let mut out: Vec<Violation> = st
        .runs()
        .into_iter()
        .map(|(first, step, value)| Violation::Run {
            cells: vec![first as u16, (first + step) as u16, (first + 2 * step) as u16],
            value,
        })
        .collect();

    let counts = st.counts();
    for value in [VALUE_A, VALUE_B] {
        for (row, &count) in counts.rows[value as usize - 1].iter().enumerate() {
            if count > st.row_target() {
                out.push(Violation::RowCount {
                    row: row as u16,
                    value,
                    count,
                });
            }
        }
    }
    for value in [VALUE_A, VALUE_B] {
        for (column, &count) in counts.cols[value as usize - 1].iter().enumerate() {
            if count > st.col_target() {
                out.push(Violation::ColumnCount {
                    column: column as u16,
                    value,
                    count,
                });
            }
        }
    }
    out
}

/// The solution in hint-key space: `(cell index, 1 or 2)` for every cell,
/// sorted by cell. Same keys and values as hint conclusions. A solution of
/// the wrong length gives 0 (empty) for every cell. Panics on a malformed
/// description.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Vec<(u16, u8)> {
    let d = parse_description(description).expect("malformed description");
    let n = d.width as usize * d.height as usize;
    (0..n)
        .map(|i| (i as u16, if solution.len() == n { solution[i] } else { EMPTY }))
        .collect()
}

/// Number of solutions, capped at `cap`, via backtracking. Returns 0 for a
/// malformed description.
pub fn count_solutions(description: &[u8], cap: u32) -> u32 {
    let Ok(d) = parse_description(description) else {
        return 0;
    };
    let st = State::from_description(&d);
    solver::count_solutions(&st, cap)
}

/// Technique solver from the givens; returns the trace and the solution if
/// it was reached without guessing.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> (Vec<Hint>, Option<Vec<u8>>) {
    let Ok(d) = parse_description(description) else {
        return (Vec::new(), None);
    };
    let mut st = State::from_description(&d);
    let mut hints = Vec::new();
    let solution = match solver::solve(&mut st, tier, Some(&mut hints)) {
        solver::Outcome::Solved => Some(st.grid.clone()),
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
    if width < 2 || height < 2 {
        return Err("width and height must be at least 2".to_string());
    }
    if width % 2 != 0 || height % 2 != 0 {
        return Err("width and height must both be even".to_string());
    }
    let expected = 3 + width as usize * height as usize;
    if bytes.len() != expected {
        return Err(format!("expected {expected} bytes, got {}", bytes.len()));
    }
    let givens = bytes[3..]
        .iter()
        .map(|&b| match b {
            EMPTY | VALUE_A | VALUE_B => Ok(b),
            _ => Err(format!("bad given byte 0x{b:02x}")),
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Description { width, height, givens })
}

pub(crate) fn encode_description(st: &State) -> Vec<u8> {
    let mut out = Vec::with_capacity(3 + st.size());
    out.push(FORMAT_VERSION);
    out.push(st.w as u8);
    out.push(st.h as u8);
    out.extend_from_slice(&st.grid);
    out
}

/// Tatham's text format: one line per row, each cell rendered as `1`
/// (first value), `0` (second value) or `.`, each followed by a space.
/// Without a grid the givens are shown.
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> String {
    let Ok(d) = parse_description(description) else {
        return String::new();
    };
    let st = State::from_description(&d);
    let cells = match grid.filter(|g| g.len() == st.size()) {
        Some(g) => g,
        None => &st.grid,
    };
    let mut out = String::with_capacity((2 * st.w + 1) * st.h);
    for y in 0..st.h {
        for x in 0..st.w {
            out.push(match cells[y * st.w + x] {
                VALUE_A => '1',
                VALUE_B => '0',
                _ => '.',
            });
            out.push(' ');
        }
        out.push('\n');
    }
    out
}
