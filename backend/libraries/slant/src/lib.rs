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
//! | 4 | DeadEndAvoidance | the cell being decided | This slant would join two groups of points that never reach the border and have no other way out, sealing them inside a loop; the cell must slant the other way. |
//! | 5 | Equivalence | the cell being decided | This cell must slant the same way as the highlighted cell it is tied to, which is already filled. |
//! | 6 | PairedClue | the clue vertex | Two adjacent undecided cells around this clue must slant the same way, so between them they supply exactly one line; that fixes the remaining cells. |

mod dsf;
mod generate;
mod rng;
mod solver;
mod state;

use state::State;

pub const GAME_ID: &str = "slant";

const FORMAT_VERSION: u8 = 1;
const NO_CLUE: u8 = 0xFF;
pub const BACKSLASH: u8 = 1;
pub const SLASH: u8 = 2;

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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hint {
    pub technique: Technique,
    /// Cell indices (y*width+x) and vertex keys (width*height + vertex
    /// index) the deduction looked at.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at ("this cell", "this number"): a subset of
    /// `focus`, painted strongly by the client while the rest of `focus` is context.
    pub target: Vec<u16>,
    /// (cell index, value) where value 1 = backslash, 2 = slash.
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
/// Panics if width or height is below 2.
pub fn generate(seed: u64, params: Params) -> Generated {
    generate::generate(seed, params)
}

/// Rule check used by tests and mirrored by the client. `grid` is w*h
/// bytes, 1 = backslash, 2 = slash, anything else = undecided. A grid of
/// the wrong length is treated as empty. Undecided cells are not
/// violations (the grid is merely incomplete). Panics on a malformed
/// description.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Vec<Violation> {
    let d = parse_description(description).expect("malformed description");
    let mut st = State::from_description(&d);
    if grid.len() == st.size() {
        for (i, &b) in grid.iter().enumerate() {
            st.soln[i] = decode_slash(b);
        }
    }
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
    let mut forest = State::from_description(&d);
    let mut dsf = dsf::Dsf::new(st.vertices());
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

/// The solution in hint-key space: `(cell index, 1 = backslash / 2 =
/// slash)` for every cell, sorted by cell. Same keys and values as hint
/// conclusions. A solution of the wrong length gives 0 (undecided) for
/// every cell. Panics on a malformed description.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Vec<(u16, u8)> {
    let d = parse_description(description).expect("malformed description");
    let n = d.width as usize * d.height as usize;
    (0..n)
        .map(|i| (i as u16, if solution.len() == n { solution[i] } else { 0 }))
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

/// Technique solver from the empty grid; returns the trace and the
/// solution if it was reached without guessing.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> (Vec<Hint>, Option<Vec<u8>>) {
    let Ok(d) = parse_description(description) else {
        return (Vec::new(), None);
    };
    let mut st = State::from_description(&d);
    let mut hints = Vec::new();
    let solution = match solver::solve(&mut st, tier, Some(&mut hints)) {
        solver::Outcome::Solved => Some(st.soln.iter().map(|&v| encode_slash(v)).collect()),
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
    let expected = 3 + (width as usize + 1) * (height as usize + 1);
    if bytes.len() != expected {
        return Err(format!("expected {expected} bytes, got {}", bytes.len()));
    }
    let clues = bytes[3..]
        .iter()
        .map(|&b| match b {
            NO_CLUE => Ok(None),
            0..=4 => Ok(Some(b)),
            _ => Err(format!("bad clue byte 0x{b:02x}")),
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
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> String {
    let Ok(d) = parse_description(description) else {
        return String::new();
    };
    let mut st = State::from_description(&d);
    if let Some(g) = grid.filter(|g| g.len() == st.size()) {
        for (i, &b) in g.iter().enumerate() {
            st.soln[i] = decode_slash(b);
        }
    }
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
    out
}
