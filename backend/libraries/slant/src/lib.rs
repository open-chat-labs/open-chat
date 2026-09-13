//! Slant (Gokigen Naname) puzzle generator, technique solver and rule
//! checker.
//!
//! The generator and solver are a port of `slant.c` from Simon Tatham's
//! Portable Puzzle Collection. Tatham's Slant solver never guesses at any
//! difficulty, so both of his tiers are ported: DIFF_EASY is `Tier::Easy`
//! and DIFF_HARD is `Tier::Tricky`.
//!
//! slant.c is copyright (c) 2004-2024 Simon Tatham and contributors and
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
//! height, then (width+1)*(height+1) vertex clue bytes in row-major
//! order: 0xFF = no clue, else 0..=4.
//!
//! Solution / grid: width*height cell bytes row-major, 1 = backslash
//! (top-left to bottom-right), 2 = slash (bottom-left to top-right). A
//! grid may hold 0 for an undecided cell; a solution never does.
//!
//! Hint keys are cell indices (y*width+x) and values are 1 / 2 as above.
//! `focus` entries below width*height are cells; an entry at or above
//! width*height is a vertex, `width*height + vertex_index` (see
//! [`vertex_key`]), so a hint can point at the clue it used. `target` is
//! the non-empty subset of `focus`, in the same key space, that the
//! technique's sentence points at ("this cell", "this number"); the rest
//! of `focus` is the context the deduction read.
//!
//! # Techniques
//!
//! | id | name | target | explanation |
//! |----|------|--------|-------------|
//! | 1 | ClueSatisfied | the clue vertex | This clue already has all {n} of its lines, so every other cell around it must slant away from it. |
//! | 2 | ClueForced | the clue vertex | This clue still needs {n} more lines and has exactly {n} undecided cells around it, so they must all slant towards it. |
//! | 3 | LoopAvoidance | the cell being decided | The two corners this slant would join are already connected by a path of diagonals, so joining them would close a loop; the cell must slant the other way. |
//! | 4 | DeadEndAvoidance | the cell being decided | This slant would join two groups of points that never reach the border and have no other way out, sealing them inside a loop; the cell must slant the other way. Its `focus` is the part of those two groups nearest the cell, not all of them: by the end of a solve they cover most of the board. |
//! | 5 | Equivalence | the cell being decided | This cell must slant the same way as the highlighted cell it is tied to, which is already filled. |
//! | 6 | PairedClue | the clue vertex | Two adjacent undecided cells around this clue must slant the same way, so between them they supply exactly one line; that fixes the remaining cells. |

mod generate;
mod solver;
mod state;

use puzzle_core::{Dsf, GenerateError, Puzzle, PuzzleError, SearchBudget, checked_grid_values, side_ok, side_too_big};
use state::State;

pub use puzzle_core::Tier;

/// This game, as the [`Puzzle`] trait sees it.
#[derive(Clone, Copy, Debug, Default)]
pub struct Slant;

/// Generator work budget, in solver runs (see [`puzzle_core::Budget`]).
/// Slant's generator never backtracks (Gareth Taylor's chessboard
/// argument in slant.c), so an attempt fails only when clue stripping
/// leaves a puzzle the tier below can also solve — but that stripping is
/// two passes of one solve per vertex, which is what the budget has to
/// count. Measured 2026-09-11: the sizes this game accepts succeed within
/// a handful of attempts.
const MAX_WORK: u32 = 8_000;

pub const GAME_ID: &str = "slant";

const FORMAT_VERSION: u8 = 1;
const NO_CLUE: u8 = 0xFF;
pub const BACKSLASH: u8 = 1;
pub const SLASH: u8 = 2;

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub width: u8,
    pub height: u8,
    pub tier: Tier,
}

impl Params {
    /// Slant has no density knobs; Tatham's generator takes only the size
    /// and difficulty.
    pub fn default_for(width: u8, height: u8, tier: Tier) -> Params {
        Params { width, height, tier }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    ClueSatisfied = 1,
    ClueForced = 2,
    LoopAvoidance = 3,
    DeadEndAvoidance = 4,
    Equivalence = 5,
    PairedClue = 6,
}

impl From<Technique> for u8 {
    fn from(technique: Technique) -> u8 {
        technique as u8
    }
}

/// Keys are cell indices (y*width+x) and vertex keys (see
/// [`vertex_key`]); conclusion values are 1 = backslash, 2 = slash.
pub type Hint = puzzle_core::Hint<Technique>;
pub type Generated = puzzle_core::Generated<Technique>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Description {
    pub width: u8,
    pub height: u8,
    /// (width+1)*(height+1) vertex clues, row-major.
    pub clues: Vec<Option<u8>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    /// The clue at `vertex` can no longer be met: `lines` diagonals touch
    /// it already and at most `possible` could once the undecided cells
    /// around it are filled.
    VertexCount {
        vertex: u16,
        expected: u8,
        lines: u8,
        possible: u8,
    },
    /// The diagonals in these cells form a closed loop.
    Loop { cells: Vec<u16> },
}

/// Focus key for a vertex: vertices live above the cell range.
pub fn vertex_key(width: usize, height: usize, vertex: usize) -> u16 {
    (width * height + vertex) as u16
}

pub(crate) fn encode_slash(v: i8) -> u8 {
    if v < 0 { BACKSLASH } else { SLASH }
}

fn decode_slash(b: u8) -> i8 {
    match b {
        BACKSLASH => -1,
        SLASH => 1,
        _ => 0,
    }
}

/// Deterministic: the same seed and params always give the same bytes.
pub fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    generate::generate(seed, params)
}

/// Load a player's grid into a state. `grid` is w*h bytes: 0 =
/// undecided, 1 = backslash, 2 = slash. Anything else is a caller bug and
/// is reported rather than read as undecided.
///
/// The parsed description comes back with the state so that a caller
/// needing both parses the bytes once.
fn load(description: &[u8], grid: &[u8]) -> Result<(Description, State), PuzzleError> {
    let d = parse_description(description)?;
    let mut st = State::from_description(&d);
    let grid = checked_grid_values(grid, st.size(), SLASH)?;
    for (i, &b) in grid.iter().enumerate() {
        st.soln[i] = decode_slash(b);
    }
    Ok((d, st))
}

/// Rule check used by tests and mirrored by the client. Reports only what
/// is definitely wrong: undecided cells are not violations (the grid is
/// merely incomplete), and a clue counts as broken only once it can no
/// longer come out right. See [`is_complete`] for whether the grid is
/// finished.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Violation>, PuzzleError> {
    let (d, st) = load(description, grid)?;
    Ok(violations(&d, &st))
}

/// The rule check itself, on a grid already loaded, so that
/// [`Puzzle::is_solved`] can ask both questions off one parse.
fn violations(d: &Description, st: &State) -> Vec<Violation> {
    let mut out = Vec::new();

    let vw = st.vw();
    for vy in 0..=st.h {
        for vx in 0..vw {
            let vertex = vy * vw + vx;
            let Some(expected) = st.clues[vertex] else {
                continue;
            };
            let (nb, n) = st.vertex_neighbours(vx, vy);
            let (mut lines, mut undecided) = (0u8, 0u8);
            for &(j, s) in &nb[..n] {
                if st.soln[j] == 0 {
                    undecided += 1;
                } else if st.soln[j] == s {
                    lines += 1;
                }
            }
            let possible = lines + undecided;
            if lines > expected || possible < expected {
                out.push(Violation::VertexCount {
                    vertex: vertex as u16,
                    expected,
                    lines,
                    possible,
                });
            }
        }
    }

    // Build a spanning forest cell by cell; every diagonal that would
    // join two already-connected vertices closes a loop, reported with
    // the forest path it closes.
    let mut forest = State::from_description(d);
    let mut dsf = Dsf::new(st.vertices());
    for i in 0..st.size() {
        let v = st.soln[i];
        if v == 0 {
            continue;
        }
        let (a, b) = st.endpoints(i, v);
        if dsf.equivalent(a, b) {
            let mut cells: Vec<u16> = forest.path_cells(a, b).into_iter().map(|c| c as u16).collect();
            cells.push(i as u16);
            out.push(Violation::Loop { cells });
        } else {
            dsf.merge(a, b);
            forest.soln[i] = v;
        }
    }
    out
}

/// Whether every cell holds a diagonal. Every other completion condition
/// is already a violation while it is unmet, so pair this with
/// [`check_rules`], or use [`Puzzle::is_solved`].
pub fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
    let (_, st) = load(description, grid)?;
    Ok(st.soln.iter().all(|&v| v != 0))
}

/// The solution in hint-key space: `(cell index, 1 = backslash / 2 =
/// slash)` for every cell, sorted by cell. Same keys and values as hint
/// conclusions.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError> {
    let d = parse_description(description)?;
    let n = d.width as usize * d.height as usize;
    let solution = checked_grid_values(solution, n, SLASH)?;
    Ok((0..n).map(|i| (i as u16, solution[i])).collect())
}

/// Number of solutions, capped at `cap`, via backtracking.
pub fn count_solutions(description: &[u8], cap: u32) -> Result<u32, PuzzleError> {
    let d = parse_description(description)?;
    let st = State::from_description(&d);
    Ok(solver::count_solutions(&st, cap, &mut SearchBudget::default()))
}

/// Technique solver from the empty grid; returns the trace and the
/// solution if it was reached without guessing.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> Result<(Vec<Hint>, Option<Vec<u8>>), PuzzleError> {
    let d = parse_description(description)?;
    let mut st = State::from_description(&d);
    let mut hints = Vec::new();
    let solution = match solver::solve(&mut st, tier, Some(&mut hints)) {
        solver::Outcome::Solved => Some(st.soln.iter().map(|&v| encode_slash(v)).collect()),
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
    let expected = 3 + (width as usize + 1) * (height as usize + 1);
    if bytes.len() != expected {
        return Err(PuzzleError::description(format!(
            "expected {expected} bytes, got {}",
            bytes.len()
        )));
    }
    let clues = bytes[3..]
        .iter()
        .map(|&b| match b {
            NO_CLUE => Ok(None),
            0..=4 => Ok(Some(b)),
            _ => Err(PuzzleError::description(format!("bad clue byte 0x{b:02x}"))),
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Description { width, height, clues })
}

pub(crate) fn encode_description(st: &State) -> Vec<u8> {
    let mut out = Vec::with_capacity(3 + st.vertices());
    out.push(FORMAT_VERSION);
    out.push(st.w as u8);
    out.push(st.h as u8);
    out.extend(st.clues.iter().map(|c| c.unwrap_or(NO_CLUE)));
    out
}

/// Tatham's text format: 2h+1 lines of 2w+1 characters. Vertex rows show
/// the clue digit or `+`, joined by `-`; cell rows show `|` between cells
/// holding `\`, `/` or a space.
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
    let st = match grid {
        Some(g) => load(description, g)?.1,
        None => State::from_description(&parse_description(description)?),
    };
    let (w, h, vw) = (st.w, st.h, st.vw());
    let mut out = String::with_capacity((2 * h + 1) * (2 * w + 2));
    for vy in 0..=h {
        for vx in 0..=w {
            out.push(match st.clues[vy * vw + vx] {
                Some(c) => (b'0' + c) as char,
                None => '+',
            });
            if vx < w {
                out.push('-');
            }
        }
        out.push('\n');
        if vy < h {
            for vx in 0..=w {
                out.push('|');
                if vx < w {
                    out.push(match st.soln[vy * w + vx] {
                        -1 => '\\',
                        1 => '/',
                        _ => ' ',
                    });
                }
            }
            out.push('\n');
        }
    }
    Ok(out)
}

impl Puzzle for Slant {
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

    /// One `load` answers both halves, so the default implementation's
    /// second parse and second grid build are avoidable here.
    fn is_solved(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        let (d, st) = load(description, grid)?;
        Ok(st.soln.iter().all(|&v| v != 0) && violations(&d, &st).is_empty())
    }
}
