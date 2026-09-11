//! Bridges (Hashiwokakero) puzzle generator, technique solver and rule
//! checker.
//!
//! The generator and solver are a port of `bridges.c` from Simon Tatham's
//! Portable Puzzle Collection: the island placement of `new_game_desc`
//! and solver stages 1 and 2 (DIFF_EASY and DIFF_MEDIUM). Stage 3
//! (DIFF_HARD, the trial-connection subgroup search) is not ported, and
//! loops are always allowed.
//!
//! bridges.c is copyright (c) 2004-2024 Simon Tatham and contributors and
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
//! height, then width*height cell bytes in row-major order: 0 = water,
//! 1..=8 = island with that bridge count.
//!
//! Solution / grid: width*height bytes row-major, one per cell: 0 =
//! nothing (always 0 on island cells), 1 = one horizontal bridge passing
//! through, 2 = two horizontal, 3 = one vertical, 4 = two vertical.
//!
//! Keys (hint conclusions): an edge is a pair of islands with only water
//! between them, keyed by `from_cell * 2 + dir` where `from_cell` is the
//! left / top island's cell index and dir 0 = towards the right, 1 =
//! downwards. Values are bridge counts 0, 1 or 2. Hint `focus` entries are
//! plain cell indices: the island the deduction was about, the water cells
//! of the edges it considered and the islands at their far ends. `target`
//! is the subset of `focus` the technique's sentence points at, in the
//! same cell-index space: the island for techniques 1 and 2, and the
//! island plus every neighbour the step forced a bridge to for technique
//! 3. It is never empty.
//!
//! # Techniques
//!
//! | id | name | sentence |
//! |----|------|----------|
//! | 1 | AllSpacesNeeded | Island {n} can only reach {n} bridges by using every bridge that still fits around it. |
//! | 2 | OneEachWay | Island {n} has too many bridges to leave any neighbour out, so it needs at least one bridge in every possible direction. |
//! | 3 | NeedsNeighbour | Without a bridge to this neighbour the other directions could not give island {n} its {n} bridges. (Tricky only) |
//!
//! Easy = Tatham DIFF_EASY (techniques 1-2, his solver stage 1). Tricky =
//! Tatham DIFF_MEDIUM (adds technique 3, his stage 2), the next tier up
//! that needs no recursion. A step's conclusions are every edge whose
//! count it made certain: the edges it placed bridges on, edges those
//! bridges cross, and the remaining edges of any island it filled. A step
//! that only raises a lower bound (one bridge "at least") records nothing
//! for that edge; the later step that fixes it does.

mod generate;
mod solver;
mod state;

use puzzle_core::{Dsf, GenerateError, Puzzle, PuzzleError, checked_grid};
use state::State;

pub use puzzle_core::Tier;

/// This game, as the [`Puzzle`] trait sees it.
#[derive(Clone, Copy, Debug, Default)]
pub struct Bridges;

pub const GAME_ID: &str = "bridges";

const FORMAT_VERSION: u8 = 1;
const MAX_ISLAND: u8 = 8;
/// Grid bytes run 0 = water, 1..=2 horizontal bridges, 3..=4 vertical.
const MAX_BRIDGE_BYTE: u8 = 4;

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub width: u8,
    pub height: u8,
    /// Percentage of cells that are islands, 1..=30 (Tatham's default 30).
    pub island_pct: u8,
    /// Chance in percent that a new island goes as far as it can, or that
    /// a spur joins an existing island (Tatham's default 10).
    pub expansion_pct: u8,
    pub tier: Tier,
}

impl Params {
    pub fn default_for(width: u8, height: u8, tier: Tier) -> Params {
        Params {
            width,
            height,
            island_pct: 30,
            expansion_pct: 10,
            tier,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    AllSpacesNeeded = 1,
    OneEachWay = 2,
    NeedsNeighbour = 3,
}

impl From<Technique> for u8 {
    fn from(technique: Technique) -> u8 {
        technique as u8
    }
}

/// Conclusion keys are edge keys with a bridge count of 0..=2; focus keys
/// are cell indices (y*width+x).
pub type Hint = puzzle_core::Hint<Technique>;
pub type Generated = puzzle_core::Generated<Technique>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Description {
    pub width: u8,
    pub height: u8,
    /// 0 = water, 1..=8 = island with that bridge count.
    pub cells: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    /// A bridge byte on a cell that holds an island.
    BridgeOnIsland {
        cell: u16,
    },
    /// A bridge byte on a cell that is not between two islands in that
    /// orientation.
    Stray {
        cell: u16,
    },
    /// The cells between two islands do not all carry the same bridges.
    Inconsistent {
        key: u16,
    },
    Crossing {
        horizontal: u16,
        vertical: u16,
    },
    /// This island already has more bridges than its number allows. An
    /// island short of its number is not a violation: the grid is merely
    /// unfinished.
    IslandCount {
        cell: u16,
        expected: u8,
        actual: u8,
    },
    /// Every island is satisfied but these islands are cut off from the
    /// island with the lowest cell index.
    Disconnected {
        islands: Vec<u16>,
    },
}

/// Deterministic: the same seed and params always give the same bytes.
pub fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    generate::generate(seed, params)
}

/// What one pass over a player's grid finds.
struct Scan {
    violations: Vec<Violation>,
    /// Every island has exactly the bridges its number asks for.
    all_full: bool,
    /// Every island is reachable from the first one.
    connected: bool,
}

/// `grid` is w*h bytes in the solution encoding. A byte outside it is a
/// caller bug and is reported rather than read as water.
fn scan(description: &[u8], grid: &[u8]) -> Result<(State, Scan), PuzzleError> {
    let d = parse_description(description)?;
    let st = State::from_description(&d);
    let n = st.size();
    let grid = checked_grid(grid, n)?;
    if let Some((i, &byte)) = grid.iter().enumerate().find(|&(_, &b)| b > MAX_BRIDGE_BYTE) {
        return Err(PuzzleError::GridValue { cell: i as u16, byte });
    }
    let mut out = Vec::new();

    let mut on_h = vec![false; n];
    let mut on_v = vec![false; n];
    for edge in &st.edges {
        let on = if edge.horizontal { &mut on_h } else { &mut on_v };
        for &c in &edge.cells {
            on[c] = true;
        }
    }
    for (i, &b) in grid.iter().enumerate() {
        let stray = match b {
            1 | 2 => !on_h[i],
            3 | 4 => !on_v[i],
            _ => false,
        };
        if st.cell_island[i].is_some() {
            if b != 0 {
                out.push(Violation::BridgeOnIsland { cell: i as u16 });
            }
        } else if stray {
            out.push(Violation::Stray { cell: i as u16 });
        }
    }
    let layout_ok = out.is_empty();

    // Bridge count per edge from its cells; bytes of the other orientation
    // belong to a crossing edge and are judged there.
    let mut bridges = vec![0u8; st.edges.len()];
    for (e, edge) in st.edges.iter().enumerate() {
        let mut val: Option<u8> = None;
        let mut zero = false;
        let mut mixed = false;
        for &c in &edge.cells {
            let own = match (edge.horizontal, grid[c]) {
                (true, 1 | 2) => Some(grid[c]),
                (false, 3 | 4) => Some(grid[c] - 2),
                (_, 0) => {
                    zero = true;
                    None
                }
                (_, 1..=4) => None,
                _ => {
                    zero = true;
                    None
                }
            };
            if let Some(v) = own {
                match val {
                    None => val = Some(v),
                    Some(x) if x != v => mixed = true,
                    _ => {}
                }
            }
        }
        match (val, zero, mixed) {
            (Some(v), false, false) => bridges[e] = v,
            (None, _, _) => {}
            _ => out.push(Violation::Inconsistent { key: edge.key }),
        }
    }
    let layout_ok = layout_ok && out.is_empty();

    for (e, edge) in st.edges.iter().enumerate() {
        if !edge.horizontal || bridges[e] == 0 {
            continue;
        }
        for &c in &edge.crossings {
            if bridges[c] > 0 {
                out.push(Violation::Crossing {
                    horizontal: edge.key,
                    vertical: st.edges[c].key,
                });
            }
        }
    }

    let mut all_full = true;
    // An island short of its number means the grid is unfinished, not
    // wrong; only an island over its number is a rule broken.
    for (i, island) in st.islands.iter().enumerate() {
        let actual: u8 = st.island_edges(i).map(|e| bridges[e]).sum();
        if actual != island.count {
            all_full = false;
        }
        if actual > island.count {
            out.push(Violation::IslandCount {
                cell: island.cell as u16,
                expected: island.count,
                actual,
            });
        }
    }

    let mut connected = true;
    if layout_ok && all_full && !st.islands.is_empty() {
        let mut dsf = Dsf::new(st.islands.len());
        for (e, edge) in st.edges.iter().enumerate() {
            if bridges[e] > 0 {
                dsf.merge(edge.a, edge.b);
            }
        }
        let root = dsf.find(0);
        let mut groups: Vec<(usize, Vec<u16>)> = Vec::new();
        for i in 1..st.islands.len() {
            let r = dsf.find(i);
            if r == root {
                continue;
            }
            match groups.iter_mut().find(|(g, _)| *g == r) {
                Some((_, cells)) => cells.push(st.islands[i].cell as u16),
                None => groups.push((r, vec![st.islands[i].cell as u16])),
            }
        }
        connected = groups.is_empty();
        for (_, islands) in groups {
            out.push(Violation::Disconnected { islands });
        }
    }
    Ok((
        st,
        Scan {
            violations: out,
            all_full,
            connected,
        },
    ))
}

/// Rule check used by tests and mirrored by the client. Reports only what
/// is definitely wrong: a half-built layout is unfinished, not broken.
/// See [`is_complete`] for whether the grid is finished.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Violation>, PuzzleError> {
    Ok(scan(description, grid)?.1.violations)
}

/// Whether every island has exactly its number of bridges and they all
/// hang together in one group. Says nothing about whether the layout is
/// *right*: pair it with [`check_rules`], or use [`Puzzle::is_solved`].
pub fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
    let (st, scan) = scan(description, grid)?;
    Ok(scan.all_full && scan.connected && !st.islands.is_empty())
}

/// The solution in hint-key space: `(edge key, bridge count 0..=2)` for
/// every edge (pair of islands with only water between them, the same
/// enumeration the hints use), sorted by key. The count is read from the
/// edge's first water cell; a solution of the wrong length counts as
/// having no bridges. Panics on a malformed description.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError> {
    let d = parse_description(description)?;
    let st = State::from_description(&d);
    let n = st.size();
    let solution = checked_grid(solution, n)?;
    let mut out: Vec<(u16, u8)> = st
        .edges
        .iter()
        .map(|edge| {
            let b = solution[edge.cells[0]];
            let count = match (edge.horizontal, b) {
                (true, 1 | 2) => b,
                (false, 3 | 4) => b - 2,
                _ => 0,
            };
            (edge.key, count)
        })
        .collect();
    out.sort_unstable_by_key(|&(k, _)| k);
    Ok(out)
}

/// Number of solutions, capped at `cap`, via backtracking.
pub fn count_solutions(description: &[u8], cap: u32) -> Result<u32, PuzzleError> {
    let d = parse_description(description)?;
    let mut st = State::from_description(&d);
    Ok(solver::count_solutions(&mut st, cap))
}

/// Technique solver from the empty grid; returns the trace and the
/// solution if it was reached without guessing.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> Result<(Vec<Hint>, Option<Vec<u8>>), PuzzleError> {
    let d = parse_description(description)?;
    let mut st = State::from_description(&d);
    let mut hints = Vec::new();
    let solution = match solver::solve(&mut st, tier, Some(&mut hints)) {
        solver::Outcome::Solved => Some(st.to_grid()),
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
    let (w, h) = (width as usize, height as usize);
    if w * h > 32767 {
        return Err(PuzzleError::description("grid too large"));
    }
    let expected = 3 + w * h;
    if bytes.len() != expected {
        return Err(PuzzleError::description(format!(
            "expected {expected} bytes, got {}",
            bytes.len()
        )));
    }
    let cells = bytes[3..].to_vec();
    let mut islands = 0;
    for (i, &b) in cells.iter().enumerate() {
        if b > MAX_ISLAND {
            return Err(PuzzleError::description(format!("bad cell byte 0x{b:02x}")));
        }
        if b == 0 {
            continue;
        }
        islands += 1;
        let (x, y) = (i % w, i / w);
        if (x > 0 && cells[i - 1] != 0) || (y > 0 && cells[i - w] != 0) {
            return Err(PuzzleError::description(format!("islands touch at cell {i}")));
        }
    }
    if islands < 2 {
        return Err(PuzzleError::description("too few islands"));
    }
    Ok(Description { width, height, cells })
}

pub(crate) fn encode_description(d: &Description) -> Vec<u8> {
    let mut out = Vec::with_capacity(3 + d.cells.len());
    out.push(FORMAT_VERSION);
    out.push(d.width);
    out.push(d.height);
    out.extend_from_slice(&d.cells);
    out
}

/// One line per row, Tatham's text format: digit = island, `.` water,
/// `-` / `=` one / two horizontal bridges, `|` / `"` one / two vertical.
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
    let d = parse_description(description)?;
    let (w, h) = (d.width as usize, d.height as usize);
    let grid = grid.map(|g| checked_grid(g, w * h)).transpose()?;
    let mut out = String::with_capacity((w + 1) * h);
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let b = grid.map_or(0, |g| g[i]);
            out.push(match (d.cells[i], b) {
                (n, _) if n > 0 => (b'0' + n) as char,
                (_, 1) => '-',
                (_, 2) => '=',
                (_, 3) => '|',
                (_, 4) => '"',
                (_, 0) => '.',
                _ => '?',
            });
        }
        out.push('\n');
    }
    Ok(out)
}

impl Puzzle for Bridges {
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
}
