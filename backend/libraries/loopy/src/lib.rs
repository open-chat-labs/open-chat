//! Loopy (Slitherlink) puzzle generator, technique solver and rule
//! checker, square grid only.
//!
//! The generator and solver are a port of `loopy.c`, `loopgen.c` and the
//! square-grid case of `grid.c` from Simon Tatham's Portable Puzzle
//! Collection, minus the Hard tier (line equivalence classes).
//!
//! loopy.c is copyright (c) 2005-2006 Mike Pinna, 2008 Lambros Lambrou
//! and Simon Tatham and contributors, and is used under the MIT licence:
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
//! height, then width*height clue bytes in row-major order: 0xFF = no
//! clue, else 0..=4.
//!
//! Solution / grid: one byte per edge, 1 = line, 0 = no line. Edges are
//! ordered with every horizontal edge first — (height+1) rows of width,
//! top to bottom, left to right — then every vertical edge, height rows
//! of (width+1). So the top edge of cell (x, y) is index y*width+x and
//! its left edge is (height+1)*width + y*(width+1) + x.
//!
//! Hint keys are edge indices in that order. Hint focus and target
//! entries below the edge count are edges; an entry of edge_count + c
//! marks clue cell c (row-major) and an entry of edge_count +
//! width*height + d marks dot d (row-major over the (width+1) *
//! (height+1) dots), so the client can highlight the cell or dot a
//! deduction is about.
//!
//! # Techniques
//!
//! | id | name | explanation |
//! |----|------|-------------|
//! | 1 | ClueSatisfied | This {n} already has {n} lines around it, so its other edges are crosses. |
//! | 2 | ClueNeedsAll | This {n} has only {n} edges left that can still be lines, so they all are. |
//! | 3 | LineEntersClue | A line comes into a corner of this {n} from outside, so the two edges at that corner can't both be lines, and the rest of the cell's edges must be. |
//! | 4 | DeadEnd | No line reaches this dot and only one of its edges is still open, so that edge is a cross: a line there would stop dead. |
//! | 5 | OnlyExit | A line reaches this dot and only one other edge is open, so the line continues through it. |
//! | 6 | DotComplete | This dot already has two lines, so its other edges are crosses. |
//! | 7 | CornerPairsFull | The lines forced at the corners of this {n} already make up its count, so this edge is a cross. |
//! | 8 | CornerPairsShort | Even using every line still possible at its corners, this {n} can't reach {n} without this edge, so it is a line. |
//! | 9 | PrematureLoop | Drawing this edge would close a loop that leaves other lines out, so it is a cross. |
//! | 10 | LoopClosed | The loop is complete and every clue is satisfied, so every remaining edge is a cross. |
//!
//! Easy uses 1-6, 9 and 10 (Tatham's DIFF_EASY: trivial_deductions and
//! loop_deductions). Tricky adds 7 and 8 (DIFF_NORMAL: dline_deductions).

mod generate;
mod grid;
mod solver;
mod state;

use grid::Grid;
use puzzle_core::{Dsf, GenerateError, Puzzle, PuzzleError, SearchBudget, checked_grid_values, side_ok, side_too_big};
use state::State;

pub use puzzle_core::Tier;

/// This game, as the [`Puzzle`] trait sees it.
#[derive(Clone, Copy, Debug, Default)]
pub struct Loopy;

/// Generator work budget, in solver runs (see [`puzzle_core::Budget`]).
/// One attempt draws a random loop, clues every cell and strips the clues
/// back down, running a full technique solve per clue, so attempts are
/// the most expensive of the six and counting them alone would bound
/// nothing. Measured 2026-09-11: every playable size succeeds within a
/// handful of attempts.
const MAX_WORK: u32 = 4_000;

pub const GAME_ID: &str = "loopy";

const FORMAT_VERSION: u8 = 1;
const CLUE_NONE: u8 = 0xFF;

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub width: u8,
    pub height: u8,
    pub tier: Tier,
}

impl Params {
    /// Loopy has no density knob: Tatham draws a random loop and strips
    /// clues until the solver just copes. Measured 2026-09-10: putting clues
    /// back does NOT shorten the deduction chain (a 6x6 needs ~66 steps at
    /// every clue density from 46% to 80%), because the chain length is set by
    /// the 84 edges you must decide, not by the clues. Size is the only lever.
    pub fn default_for(width: u8, height: u8, tier: Tier) -> Params {
        Params { width, height, tier }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    ClueSatisfied = 1,
    ClueNeedsAll = 2,
    LineEntersClue = 3,
    DeadEnd = 4,
    OnlyExit = 5,
    DotComplete = 6,
    CornerPairsFull = 7,
    CornerPairsShort = 8,
    PrematureLoop = 9,
    LoopClosed = 10,
}

impl From<Technique> for u8 {
    fn from(technique: Technique) -> u8 {
        technique as u8
    }
}

/// Conclusion keys are edge indices, values 1 = line, 0 = no line. Focus
/// also carries `edge_count + cell` for a clue cell and
/// `edge_count + cells + dot` for a dot: see the module doc.
pub type Hint = puzzle_core::Hint<Technique>;
pub type Generated = puzzle_core::Generated<Technique>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Description {
    pub width: u8,
    pub height: u8,
    /// Row-major, None = no clue.
    pub clues: Vec<Option<u8>>,
}

impl Description {
    /// Number of edges, and the offset of cell markers in hint focus.
    pub fn edge_count(&self) -> usize {
        Grid {
            w: self.width as usize,
            h: self.height as usize,
        }
        .edges()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    /// The clue cell already has more lines around it than it allows. A
    /// clue with too few is not a violation: the grid is merely
    /// unfinished.
    ClueCount { cell: u16, expected: u8, actual: u8 },
    /// A dot (index y*(width+1)+x) with three or more lines, which no
    /// single loop can pass through. A dot with one line is the end of a
    /// path the player has not closed yet, not a rule broken.
    DotDegree { dot: u16, degree: u8 },
    /// Every dot has zero or two lines but they form more than one loop;
    /// one of these per loop other than the largest, listing its edges.
    ExtraLoop { edges: Vec<u16> },
}

/// Deterministic: the same seed and params always give the same bytes.
pub fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    generate::generate(seed, params)
}

/// What one pass over a player's grid finds.
struct Scan {
    violations: Vec<Violation>,
    /// Every clue has exactly the lines it asks for.
    clues_exact: bool,
    /// Every dot has no lines or two, so the lines form closed loops.
    closed: bool,
    /// Exactly one loop, with at least one edge in it.
    single_loop: bool,
}

/// `grid` is one byte per edge: 1 = line, 0 = no line. Anything else is a
/// caller bug and is reported rather than read as no line.
fn scan(description: &[u8], grid: &[u8]) -> Result<(Description, Grid, Scan), PuzzleError> {
    let d = parse_description(description)?;
    let g = Grid {
        w: d.width as usize,
        h: d.height as usize,
    };
    let grid = checked_grid_values(grid, g.edges(), 1)?;
    let line = |e: usize| grid[e] != 0;
    let mut out = Vec::new();
    let mut clues_exact = true;

    for (f, clue) in d.clues.iter().enumerate() {
        let Some(expected) = *clue else {
            continue;
        };
        let actual = g.cell_edges(f).into_iter().filter(|&e| line(e)).count() as u8;
        if actual != expected {
            clues_exact = false;
        }
        // Too few lines round a clue means the grid is unfinished, not
        // wrong; only too many is a rule broken.
        if actual > expected {
            out.push(Violation::ClueCount {
                cell: f as u16,
                expected,
                actual,
            });
        }
    }

    // A dot with one line is the loose end of a path the player is still
    // drawing. Three or more can never be part of a single loop.
    let mut closed = true;
    for dot in 0..g.dots() {
        let degree = g.dot_edges(dot).iter().filter(|&&e| line(e)).count() as u8;
        if degree != 0 && degree != 2 {
            closed = false;
        }
        if degree >= 3 {
            out.push(Violation::DotDegree { dot: dot as u16, degree });
        }
    }
    if !closed {
        return Ok((
            d,
            g,
            Scan {
                violations: out,
                clues_exact,
                closed,
                single_loop: false,
            },
        ));
    }

    let mut dsf = Dsf::new(g.dots());
    for e in (0..g.edges()).filter(|&e| line(e)) {
        let (a, b) = g.edge_dots(e);
        dsf.merge(a, b);
    }
    // Loops keyed by root, in order of first appearance.
    let mut loops: Vec<(usize, Vec<u16>)> = Vec::new();
    for e in (0..g.edges()).filter(|&e| line(e)) {
        let root = dsf.find(g.edge_dots(e).0);
        match loops.iter_mut().find(|(r, _)| *r == root) {
            Some((_, edges)) => edges.push(e as u16),
            None => loops.push((root, vec![e as u16])),
        }
    }
    let single_loop = loops.len() == 1;
    if loops.len() > 1 {
        let largest = (0..loops.len()).max_by_key(|&i| (loops[i].1.len(), usize::MAX - i)).unwrap();
        for (i, (_, edges)) in loops.into_iter().enumerate() {
            if i != largest {
                out.push(Violation::ExtraLoop { edges });
            }
        }
    }
    Ok((
        d,
        g,
        Scan {
            violations: out,
            clues_exact,
            closed,
            single_loop,
        },
    ))
}

/// Rule check used by tests and mirrored by the client. Reports only what
/// is definitely wrong: a half-drawn loop is unfinished, not broken. See
/// [`is_complete`] for whether the grid is finished.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Violation>, PuzzleError> {
    Ok(scan(description, grid)?.2.violations)
}

/// Whether the lines form one closed loop that satisfies every clue
/// exactly. Says nothing about whether it is the *right* loop: pair it
/// with [`check_rules`], or use [`Puzzle::is_solved`].
pub fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
    let (_, _, scan) = scan(description, grid)?;
    Ok(scan.clues_exact && scan.closed && scan.single_loop)
}

/// The solution in hint-key space: `(edge index, 1 = line / 0 = no
/// line)` for every edge, sorted by edge. Same keys and values as hint
/// conclusions.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError> {
    let d = parse_description(description)?;
    let n = d.edge_count();
    let solution = checked_grid_values(solution, n, 1)?;
    Ok((0..n).map(|e| (e as u16, (solution[e] != 0) as u8)).collect())
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
        solver::Outcome::Solved => Some(st.line_bytes()),
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
    // The same floor `generate` validates against, so bytes no generator
    // can produce are bytes no entry point accepts.
    if width < 3 || height < 3 {
        return Err(PuzzleError::description("width and height must be at least 3"));
    }
    if !side_ok(width as usize, height as usize) {
        return Err(PuzzleError::description(side_too_big(width as usize, height as usize)));
    }
    let g = Grid {
        w: width as usize,
        h: height as usize,
    };
    if g.edges() + g.cells() + g.dots() > u16::MAX as usize {
        return Err(PuzzleError::description(format!(
            "{width}x{height} has too many edges for 16-bit keys"
        )));
    }
    let expected = 3 + g.cells();
    if bytes.len() != expected {
        return Err(PuzzleError::description(format!(
            "expected {expected} bytes, got {}",
            bytes.len()
        )));
    }
    let clues = bytes[3..]
        .iter()
        .map(|&b| match b {
            CLUE_NONE => Ok(None),
            // 4 is a legal clue, and the generator produces one whenever
            // the loop encircles a single cell.
            0..=4 => Ok(Some(b)),
            _ => Err(PuzzleError::description(format!("bad clue byte 0x{b:02x}"))),
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Description { width, height, clues })
}

pub(crate) fn encode_description(st: &State) -> Vec<u8> {
    let mut out = Vec::with_capacity(3 + st.grid.cells());
    out.push(FORMAT_VERSION);
    out.push(st.grid.w as u8);
    out.push(st.grid.h as u8);
    out.extend(st.clues.iter().map(|c| c.unwrap_or(CLUE_NONE)));
    out
}

/// Tatham's text layout: 2*height+1 rows of 2*width+1 characters, dots
/// as `+`, clues as digits, and with a grid `-` / `|` for lines.
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
    let d = parse_description(description)?;
    let g = Grid {
        w: d.width as usize,
        h: d.height as usize,
    };
    let grid = grid.map(|b| checked_grid_values(b, g.edges(), 1)).transpose()?;
    let line = |e: usize| grid.is_some_and(|b| b[e] != 0);
    let mut out = String::with_capacity((2 * g.w + 2) * (2 * g.h + 1));
    for y in 0..=g.h {
        for x in 0..g.w {
            out.push('+');
            out.push(if line(g.hedge(x, y)) { '-' } else { ' ' });
        }
        out.push_str("+\n");
        if y == g.h {
            break;
        }
        for x in 0..=g.w {
            out.push(if line(g.vedge(x, y)) { '|' } else { ' ' });
            if x < g.w {
                out.push(match d.clues[g.cell(x, y)] {
                    Some(n) => (b'0' + n) as char,
                    None => ' ',
                });
            }
        }
        out.push('\n');
    }
    Ok(out)
}

impl Puzzle for Loopy {
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
    /// second parse, second sweep and second dsf build are avoidable here.
    fn is_solved(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        let (_, _, scan) = scan(description, grid)?;
        Ok(scan.violations.is_empty() && scan.clues_exact && scan.closed && scan.single_loop)
    }
}
