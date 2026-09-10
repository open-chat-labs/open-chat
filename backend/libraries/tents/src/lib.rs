//! Tents puzzle generator, technique solver and rule checker.
//!
//! The generator and solver are a port of `tents.c` (and the matching
//! routine from `matching.c`) from Simon Tatham's Portable Puzzle
//! Collection. Tents has no recursive tier: both of Tatham's difficulties
//! are pure deduction and both are ported.
//!
//! tents.c and matching.c are copyright (c) 2004-2024 Simon Tatham and
//! contributors and are used under the MIT licence:
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
//! height, then width*height cell bytes in row-major order (0 = empty,
//! 1 = tree), then `height` row counts, then `width` column counts.
//!
//! Solution / grid: width*height bytes row-major, 1 = tent, 0 = no tent.
//! Tree cells are 0.
//!
//! Hint keys are cell indices (y*width+x); values are 1 = tent, 0 = grass.
//! `focus` is every cell the deduction looked at (for 5-6 the cells of
//! the row or column that could still take a tent, not the whole line);
//! `target` is the cell(s) its sentence points at ("this cell", "this
//! tree"): 1-2 the cell, 3 the tree, 4 the corner cell, 5-8 the concluded
//! cells.
//!
//! # Tiers
//!
//! `Easy` is Tatham's DIFF_EASY, `Tricky` is Tatham's DIFF_TRICKY. Tricky
//! adds two deductions: the corner exclusion around a tree with two
//! diagonal candidates, and reading a row or column's count across into
//! the neighbouring rows or columns.
//!
//! # Techniques
//!
//! | id | name | explanation |
//! |----|------|-------------|
//! | 1 | NoFreeTree | This cell has no unclaimed tree next to it, so it can't hold a tent. |
//! | 2 | TentTouches | A tent already touches this cell, so it can't hold a tent. |
//! | 3 | TreeNeedsTent | This tree has only one cell left where its tent can go, so that cell is a tent. |
//! | 4 | TreeCorner | This tree's tent must be in one of two cells that both touch this cell, so this cell can't hold a tent. (Tricky) |
//! | 5 | LineCount | Only these cells in the row or column can still take a tent, and every way of fitting in the ones it needs agrees about the marked cells. |
//! | 6 | LineNeighbour | Only these cells in the row or column can still take a tent, and every way of fitting in the ones it needs puts one next to the marked cells. (Tricky) |
//! | 7 | LineExact | This row or column needs as many tents as it has cells left that could hold one, so every one of them is a tent. |
//! | 8 | LineFull | This row or column already has all its tents, so no other cell in it can hold one. |

mod generate;
mod rng;
mod solver;
mod state;

use state::{Square, State};

pub const GAME_ID: &str = "tents";

const FORMAT_VERSION: u8 = 1;
const CELL_EMPTY: u8 = 0;
const CELL_TREE: u8 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Easy = 0,
    Tricky = 1,
}

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub width: u8,
    pub height: u8,
    /// Percentage of cells holding a tree (and so a tent). Tatham uses
    /// w*h/5, i.e. 20.
    pub tree_pct: u8,
    pub tier: Tier,
}

impl Params {
    pub fn default_for(width: u8, height: u8, tier: Tier) -> Self {
        Params {
            width,
            height,
            tree_pct: 20,
            tier,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    NoFreeTree = 1,
    TentTouches = 2,
    TreeNeedsTent = 3,
    TreeCorner = 4,
    LineCount = 5,
    LineNeighbour = 6,
    LineExact = 7,
    LineFull = 8,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hint {
    pub technique: Technique,
    /// Cell indices (y*width+x) to highlight: the cells the deduction
    /// looked at.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at ("this cell", "this number"): a subset of
    /// `focus`, painted strongly by the client while the rest of `focus` is context.
    pub target: Vec<u16>,
    /// (cell index, value) where value 1 = tent, 0 = grass.
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
    Empty,
    Tree,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Description {
    pub width: u8,
    pub height: u8,
    pub cells: Vec<Cell>,
    pub row_counts: Vec<u8>,
    pub column_counts: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    TentOnTree {
        cell: u16,
    },
    /// Two tents touch, orthogonally or diagonally; a < b.
    TentsTouch {
        a: u16,
        b: u16,
    },
    TentWithoutTree {
        cell: u16,
    },
    RowCount {
        row: u8,
        expected: u8,
        actual: u8,
    },
    ColumnCount {
        column: u8,
        expected: u8,
        actual: u8,
    },
    /// A connected group of trees and tents (joined by orthogonal
    /// adjacency) that does not have one tent per tree.
    Unmatched {
        trees: Vec<u16>,
        tents: Vec<u16>,
    },
}

/// Deterministic: the same seed and params always give the same bytes.
/// Panics if width or height is below 4 or tree_pct is outside 1..=25.
/// Tricky on a grid no bigger than 4x4 is downgraded to Easy, as Tatham
/// does, and `Generated::tier` reports the tier actually used.
pub fn generate(seed: u64, params: Params) -> Generated {
    generate::generate(seed, params)
}

/// Rule check used by tests and mirrored by the client. `grid` is w*h
/// bytes, 1 = tent, 0 = no tent. A grid of the wrong length is treated as
/// having no tents at all. Panics on a malformed description.
///
/// The matching rule is checked the way Tatham's error highlighter does
/// it: split the tree/tent adjacency graph into connected components and
/// report any component whose tree and tent counts differ. Together with
/// the touching check this is complete (see the lemma in tents.c): a grid
/// with no reported violation has a one-to-one tree/tent matching.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Vec<Violation> {
    let d = parse_description(description).expect("malformed description");
    let (w, h) = (d.width as usize, d.height as usize);
    let n = w * h;
    let tent = |i: usize| grid.len() == n && grid[i] != 0;
    let tree = |i: usize| d.cells[i] == Cell::Tree;
    let mut out = Vec::new();

    for i in 0..n {
        if !tent(i) {
            continue;
        }
        if tree(i) {
            out.push(Violation::TentOnTree { cell: i as u16 });
            continue;
        }
        // Right, and the three cells below, so each pair is reported once.
        for (dx, dy) in [(1i32, 0i32), (-1, 1), (0, 1), (1, 1)] {
            if let Some(j) = state::offset(w, h, i, dx, dy)
                && tent(j)
                && !tree(j)
            {
                out.push(Violation::TentsTouch {
                    a: i as u16,
                    b: j as u16,
                });
            }
        }
        let beside_tree = neighbours(w, h, i).any(tree);
        if !beside_tree {
            out.push(Violation::TentWithoutTree { cell: i as u16 });
        }
    }

    for y in 0..h {
        let actual = (0..w).filter(|&x| tent(y * w + x)).count() as u8;
        if actual != d.row_counts[y] {
            out.push(Violation::RowCount {
                row: y as u8,
                expected: d.row_counts[y],
                actual,
            });
        }
    }
    for x in 0..w {
        let actual = (0..h).filter(|&y| tent(y * w + x)).count() as u8;
        if actual != d.column_counts[x] {
            out.push(Violation::ColumnCount {
                column: x as u8,
                expected: d.column_counts[x],
                actual,
            });
        }
    }

    // Components of the bipartite tree/tent adjacency graph.
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(parent: &mut [usize], mut i: usize) -> usize {
        while parent[i] != i {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        i
    }
    for i in 0..n {
        let (x, y) = (i % w, i / w);
        for j in [(x + 1 < w).then(|| i + 1), (y + 1 < h).then(|| i + w)].into_iter().flatten() {
            let joined = (tree(i) && tent(j) && !tree(j)) || (tent(i) && !tree(i) && tree(j));
            if joined {
                let (a, b) = (find(&mut parent, i), find(&mut parent, j));
                parent[a] = b;
            }
        }
    }
    let mut members: Vec<(Vec<u16>, Vec<u16>)> = vec![(Vec::new(), Vec::new()); n];
    for i in 0..n {
        if tree(i) {
            members[find(&mut parent, i)].0.push(i as u16);
        } else if tent(i) {
            members[find(&mut parent, i)].1.push(i as u16);
        }
    }
    for (trees, tents) in members {
        // A lone tent is already reported as TentWithoutTree.
        if trees.len() != tents.len() && !trees.is_empty() {
            out.push(Violation::Unmatched { trees, tents });
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

/// The solution in hint-key space: `(cell index, 1 = tent / 0 = grass)`
/// for every non-tree cell, sorted by cell. Same keys and values as hint
/// conclusions. A solution of the wrong length counts as having no
/// tents. Panics on a malformed description.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Vec<(u16, u8)> {
    let d = parse_description(description).expect("malformed description");
    let n = d.cells.len();
    d.cells
        .iter()
        .enumerate()
        .filter(|(_, c)| **c == Cell::Empty)
        .map(|(i, _)| (i as u16, (solution.len() == n && solution[i] != 0) as u8))
        .collect()
}

/// Number of distinct tent layouts satisfying every rule, capped at
/// `cap`, via backtracking that shares nothing with the technique solver.
/// Returns 0 for a malformed description.
pub fn count_solutions(description: &[u8], cap: u32) -> u32 {
    let Ok(d) = parse_description(description) else {
        return 0;
    };
    solver::count_solutions(&d, cap)
}

/// Technique solver from the empty grid; returns the trace and the
/// solution if it was reached without guessing. Reaching it also means
/// the tree/tent matching is unique, which is what Tatham's generator
/// insists on.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> (Vec<Hint>, Option<Vec<u8>>) {
    let Ok(d) = parse_description(description) else {
        return (Vec::new(), None);
    };
    let mut st = State::from_description(&d);
    let mut hints = Vec::new();
    let solution = match solver::solve(&mut st, tier, Some(&mut hints)) {
        solver::Outcome::Solved => Some(st.tents()),
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
    if width == 0 || height == 0 {
        return Err("width and height must be non-zero".to_string());
    }
    let (w, h) = (width as usize, height as usize);
    let expected = 3 + w * h + h + w;
    if bytes.len() != expected {
        return Err(format!("expected {expected} bytes, got {}", bytes.len()));
    }
    let cells = bytes[3..3 + w * h]
        .iter()
        .map(|&b| match b {
            CELL_EMPTY => Ok(Cell::Empty),
            CELL_TREE => Ok(Cell::Tree),
            _ => Err(format!("bad cell byte 0x{b:02x}")),
        })
        .collect::<Result<Vec<_>, _>>()?;
    let row_counts = bytes[3 + w * h..3 + w * h + h].to_vec();
    let column_counts = bytes[3 + w * h + h..].to_vec();
    if let Some(c) = row_counts.iter().find(|&&c| c as usize > w) {
        return Err(format!("row count {c} exceeds width {w}"));
    }
    if let Some(c) = column_counts.iter().find(|&&c| c as usize > h) {
        return Err(format!("column count {c} exceeds height {h}"));
    }
    Ok(Description {
        width,
        height,
        cells,
        row_counts,
        column_counts,
    })
}

pub(crate) fn encode_description(st: &State) -> Vec<u8> {
    let mut out = Vec::with_capacity(3 + st.size() + st.h + st.w);
    out.push(FORMAT_VERSION);
    out.push(st.w as u8);
    out.push(st.h as u8);
    for &sq in &st.grid {
        out.push(if sq == Square::Tree { CELL_TREE } else { CELL_EMPTY });
    }
    out.extend_from_slice(&st.numbers[st.w..]);
    out.extend_from_slice(&st.numbers[..st.w]);
    out
}

/// One line per row: `T` tree, `.` empty, `A` tent (with a grid), then a
/// space and the row count; a final line of column counts. Counts of ten
/// or more print as `+`.
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> String {
    let Ok(d) = parse_description(description) else {
        return String::new();
    };
    let (w, h) = (d.width as usize, d.height as usize);
    let n = w * h;
    let tent = |i: usize| grid.is_some_and(|g| g.len() == n && g[i] != 0);
    let digit = |c: u8| if c < 10 { (b'0' + c) as char } else { '+' };
    let mut out = String::with_capacity((w + 3) * (h + 1));
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            out.push(match d.cells[i] {
                Cell::Tree => 'T',
                Cell::Empty if tent(i) => 'A',
                Cell::Empty => '.',
            });
        }
        out.push(' ');
        out.push(digit(d.row_counts[y]));
        out.push('\n');
    }
    for &c in &d.column_counts {
        out.push(digit(c));
    }
    out.push('\n');
    out
}
