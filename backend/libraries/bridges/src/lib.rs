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

mod dsf;
mod generate;
mod rng;
mod solver;
mod state;

use state::State;

pub const GAME_ID: &str = "bridges";

const FORMAT_VERSION: u8 = 1;
const MAX_ISLAND: u8 = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Easy = 0,
    Tricky = 1,
}

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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hint {
    pub technique: Technique,
    /// Cell indices (y*width+x) to highlight.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at ("this cell", "this number"): a subset of
    /// `focus`, painted strongly by the client while the rest of `focus` is context.
    pub target: Vec<u16>,
    /// (edge key, bridge count) for every edge this step made final.
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
    /// 0 = water, 1..=8 = island with that bridge count.
    pub cells: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    /// Byte above 4, or a non-zero byte on an island.
    BadByte {
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
/// Panics if width or height is below 3, island_pct is outside 1..=30 or
/// expansion_pct is above 100.
pub fn generate(seed: u64, params: Params) -> Generated {
    generate::generate(seed, params)
}

/// Rule check used by tests and mirrored by the client. `grid` is w*h
/// bytes in the solution encoding. A grid of the wrong length is treated
/// as empty. Panics on a malformed description.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Vec<Violation> {
    let d = parse_description(description).expect("malformed description");
    let st = State::from_description(&d);
    let n = st.size();
    let empty;
    let grid = if grid.len() == n {
        grid
    } else {
        empty = vec![0u8; n];
        &empty
    };
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
            0 => false,
            1 | 2 => !on_h[i],
            3 | 4 => !on_v[i],
            _ => {
                out.push(Violation::BadByte { cell: i as u16 });
                continue;
            }
        };
        if st.cell_island[i].is_some() {
            if b != 0 {
                out.push(Violation::BadByte { cell: i as u16 });
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
    for (i, island) in st.islands.iter().enumerate() {
        let actual: u8 = st.island_edges(i).map(|e| bridges[e]).sum();
        if actual != island.count {
            all_full = false;
            out.push(Violation::IslandCount {
                cell: island.cell as u16,
                expected: island.count,
                actual,
            });
        }
    }

    if layout_ok && all_full && !st.islands.is_empty() {
        let mut dsf = dsf::Dsf::new(st.islands.len());
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
        for (_, islands) in groups {
            out.push(Violation::Disconnected { islands });
        }
    }
    out
}

/// The solution in hint-key space: `(edge key, bridge count 0..=2)` for
/// every edge (pair of islands with only water between them, the same
/// enumeration the hints use), sorted by key. The count is read from the
/// edge's first water cell; a solution of the wrong length counts as
/// having no bridges. Panics on a malformed description.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Vec<(u16, u8)> {
    let d = parse_description(description).expect("malformed description");
    let st = State::from_description(&d);
    let n = st.size();
    let mut out: Vec<(u16, u8)> = st
        .edges
        .iter()
        .map(|edge| {
            let b = if solution.len() == n { solution[edge.cells[0]] } else { 0 };
            let count = match (edge.horizontal, b) {
                (true, 1 | 2) => b,
                (false, 3 | 4) => b - 2,
                _ => 0,
            };
            (edge.key, count)
        })
        .collect();
    out.sort_unstable_by_key(|&(k, _)| k);
    out
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
        solver::Outcome::Solved => Some(st.to_grid()),
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
    let (w, h) = (width as usize, height as usize);
    if w * h > 32767 {
        return Err("grid too large".to_string());
    }
    let expected = 3 + w * h;
    if bytes.len() != expected {
        return Err(format!("expected {expected} bytes, got {}", bytes.len()));
    }
    let cells = bytes[3..].to_vec();
    let mut islands = 0;
    for (i, &b) in cells.iter().enumerate() {
        if b > MAX_ISLAND {
            return Err(format!("bad cell byte 0x{b:02x}"));
        }
        if b == 0 {
            continue;
        }
        islands += 1;
        let (x, y) = (i % w, i / w);
        if (x > 0 && cells[i - 1] != 0) || (y > 0 && cells[i - w] != 0) {
            return Err(format!("islands touch at cell {i}"));
        }
    }
    if islands < 2 {
        return Err("too few islands".to_string());
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
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> String {
    let Ok(d) = parse_description(description) else {
        return String::new();
    };
    let (w, h) = (d.width as usize, d.height as usize);
    let mut out = String::with_capacity((w + 1) * h);
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let b = grid.and_then(|g| g.get(i)).copied().unwrap_or(0);
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
    out
}
