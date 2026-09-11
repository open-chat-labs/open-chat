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
mod solver;
mod state;

use puzzle_core::{GenerateError, Puzzle, PuzzleError, SearchBudget, checked_grid_values, neighbours, side_ok, side_too_big};
use state::State;

pub use puzzle_core::Tier;

/// This game, as the [`Puzzle`] trait sees it.
#[derive(Clone, Copy, Debug, Default)]
pub struct LightUp;

/// Generator work budget, in solver runs (see [`puzzle_core::Budget`]).
/// A successful attempt runs one solve per clue on top of its own, so on
/// the largest grid this game accepts an attempt is a couple of hundred
/// units; the parameter combinations that never succeed fail before
/// their first solve and exhaust the budget in under a second rather
/// than hanging.
const MAX_WORK: u32 = 4_000;

pub const GAME_ID: &str = "light_up";

const FORMAT_VERSION: u8 = 1;
const CELL_WHITE: u8 = 0x00;
const CELL_BLACK: u8 = 0x10;
const CELL_CLUE_BASE: u8 = 0x11;

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

impl Params {
    /// Tatham's default density and symmetry for a grid of this size.
    pub fn default_for(width: u8, height: u8, tier: Tier) -> Params {
        Params {
            width,
            height,
            black_pct: 20,
            symmetry: Symmetry::Rot2,
            tier,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    OnlyOneWayToLight = 1,
    ClueSatisfied = 2,
    ClueForced = 3,
    SetExclusion = 4,
}

impl From<Technique> for u8 {
    fn from(technique: Technique) -> u8 {
        technique as u8
    }
}

/// Keys are cell indices (y*width+x); conclusion values are 1 = bulb,
/// 0 = no bulb.
pub type Hint = puzzle_core::Hint<Technique>;
pub type Generated = puzzle_core::Generated<Technique>;

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
    BulbSeesBulb {
        a: u16,
        b: u16,
    },
    /// This clue already has more bulbs beside it than it allows. A clue
    /// with too few is not a violation: the grid is merely unfinished.
    ClueCount {
        clue: u16,
        expected: u8,
        actual: u8,
    },
    BulbOnBlack {
        cell: u16,
    },
}

/// Deterministic: the same seed and params always give the same bytes.
/// Rot4 on a non-square grid falls back to Rot2, as Tatham does.
pub fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    generate::generate(seed, params)
}

/// What one pass over a player's grid finds: which cells the bulbs light,
/// and everything that is definitely wrong.
struct Scan {
    violations: Vec<Violation>,
    /// Every white cell is lit by some bulb.
    all_lit: bool,
    /// Every clue has exactly the bulbs it asks for.
    clues_exact: bool,
}

/// `grid` is w*h bytes: 1 = bulb, 0 = no bulb. Anything else is a caller
/// bug and is reported rather than read as no bulb.
fn scan(description: &[u8], grid: &[u8]) -> Result<(Description, Scan), PuzzleError> {
    let d = parse_description(description)?;
    let (w, h) = (d.width as usize, d.height as usize);
    let n = w * h;
    let grid = checked_grid_values(grid, n, 1)?;
    let bulb = |i: usize| grid[i] != 0;
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

    let mut all_lit = true;
    let mut clues_exact = true;
    for (i, cell) in d.cells.iter().enumerate() {
        match *cell {
            Cell::White => {
                if !lit[i] {
                    all_lit = false;
                }
            }
            Cell::Black(Some(expected)) => {
                // A bulb on a black square is already reported above and
                // lights nothing; counting it here would let a board with
                // one on it satisfy the clue and read as complete. The
                // solver's `lit_neighbours` never counts one either.
                let actual = neighbours(w, h, i).filter(|&j| !black(j) && bulb(j)).count() as u8;
                if actual != expected {
                    clues_exact = false;
                }
                // Too few bulbs beside a clue means the grid is
                // unfinished, not wrong; only too many is a rule broken.
                if actual > expected {
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
    Ok((
        d,
        Scan {
            violations: out,
            all_lit,
            clues_exact,
        },
    ))
}

/// Rule check used by tests and mirrored by the client. Reports only what
/// is definitely wrong: a half-lit board is unfinished, not broken. See
/// [`is_complete`] for whether the grid is finished.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Violation>, PuzzleError> {
    Ok(scan(description, grid)?.1.violations)
}

/// Whether every white cell is lit and every clue has exactly the bulbs
/// it asks for. Says nothing about whether the grid is *right*: pair it
/// with [`check_rules`], or use [`Puzzle::is_solved`].
pub fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
    let (_, scan) = scan(description, grid)?;
    Ok(scan.all_lit && scan.clues_exact)
}

/// The solution in hint-key space: `(cell index, 1 = bulb / 0 = no bulb)`
/// for every white cell, sorted by cell. Same keys and values as hint
/// conclusions.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError> {
    let d = parse_description(description)?;
    let n = d.cells.len();
    let solution = checked_grid_values(solution, n, 1)?;
    Ok(d.cells
        .iter()
        .enumerate()
        .filter(|(_, c)| **c == Cell::White)
        .map(|(i, _)| (i as u16, (solution[i] != 0) as u8))
        .collect())
}

/// Number of solutions, capped at `cap`, via backtracking.
pub fn count_solutions(description: &[u8], cap: u32) -> Result<u32, PuzzleError> {
    let d = parse_description(description)?;
    let mut st = State::from_description(&d);
    Ok(solver::count_solutions(&mut st, cap, 0, &mut SearchBudget::default()))
}

/// Technique solver from the empty grid; returns the trace and the
/// solution if it was reached without guessing.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> Result<(Vec<Hint>, Option<Vec<u8>>), PuzzleError> {
    let d = parse_description(description)?;
    let mut st = State::from_description(&d);
    let mut hints = Vec::new();
    let solution = match solver::solve(&mut st, tier, Some(&mut hints)) {
        solver::Outcome::Solved => Some(st.light.iter().map(|&b| b as u8).collect()),
        _ => None,
    };
    Ok((hints, solution))
}

pub fn parse_description(bytes: &[u8]) -> Result<Description, PuzzleError> {
    if bytes.len() < 3 {
        return Err(PuzzleError::description("description too short"));
    }
    if bytes[0] != FORMAT_VERSION {
        return Err(PuzzleError::description(format!("unsupported format version {}", bytes[0])));
    }
    let (width, height) = (bytes[1], bytes[2]);
    if width < 2 || height < 2 {
        return Err(PuzzleError::description("width and height must be at least 2"));
    }
    if !side_ok(width as usize, height as usize) {
        return Err(PuzzleError::description(side_too_big(width as usize, height as usize)));
    }
    let expected = 3 + width as usize * height as usize;
    if bytes.len() != expected {
        return Err(PuzzleError::description(format!(
            "expected {expected} bytes, got {}",
            bytes.len()
        )));
    }
    let cells = bytes[3..]
        .iter()
        .map(|&b| match b {
            CELL_WHITE => Ok(Cell::White),
            CELL_BLACK => Ok(Cell::Black(None)),
            CELL_CLUE_BASE..=0x15 => Ok(Cell::Black(Some(b - CELL_CLUE_BASE))),
            _ => Err(PuzzleError::description(format!("bad cell byte 0x{b:02x}"))),
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
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
    let d = parse_description(description)?;
    let (w, h) = (d.width as usize, d.height as usize);
    let mut st = State::from_description(&d);
    if let Some(g) = grid {
        let g = checked_grid_values(g, st.size(), 1)?;
        for (i, &b) in g.iter().enumerate() {
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
    Ok(out)
}

impl Puzzle for LightUp {
    type Params = Params;
    type Technique = Technique;
    type Description = Description;
    type Violation = Violation;

    const GAME_ID: &'static str = GAME_ID;

    fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
        generate(seed, params)
    }

    fn parse_description(bytes: &[u8]) -> Result<Description, PuzzleError> {
        parse_description(bytes)
    }

    fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Violation>, PuzzleError> {
        check_rules(description, grid)
    }

    fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        is_complete(description, grid)
    }

    fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError> {
        solution_pairs(description, solution)
    }

    fn count_solutions(description: &[u8], cap: u32) -> Result<u32, PuzzleError> {
        count_solutions(description, cap)
    }

    fn solve_with_trace(description: &[u8], tier: Tier) -> Result<(Vec<Hint>, Option<Vec<u8>>), PuzzleError> {
        solve_with_trace(description, tier)
    }

    fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
        render_ascii(description, grid)
    }

    /// One `scan` answers both halves, so the default implementation's
    /// second parse and second sweep are avoidable here.
    fn is_solved(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        let (_, scan) = scan(description, grid)?;
        Ok(scan.violations.is_empty() && scan.all_lit && scan.clues_exact)
    }
}
