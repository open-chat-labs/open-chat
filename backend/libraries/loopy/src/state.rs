use crate::Description;
use crate::grid::Grid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Line {
    Yes,
    Unknown,
    No,
}

const DLINE_ATLEASTONE: u8 = 1;
const DLINE_ATMOSTONE: u8 = 2;

/// Working grid plus the solver's caches: the port of Tatham's
/// `game_state` and `solver_state` folded together, since nothing here
/// needs them apart.
#[derive(Clone)]
pub(crate) struct State {
    pub grid: Grid,
    pub clues: Vec<Option<u8>>,
    pub lines: Vec<Line>,
    pub dot_yes: Vec<u8>,
    pub dot_no: Vec<u8>,
    pub face_yes: Vec<u8>,
    pub face_no: Vec<u8>,
    pub dot_solved: Vec<bool>,
    pub face_solved: Vec<bool>,
    /// One entry per dline (an adjacent pair of edges at a dot): bit 0 =
    /// at least one of the pair is a line, bit 1 = at most one is.
    dlines: Vec<u8>,
}

impl State {
    pub fn new(grid: Grid, clues: Vec<Option<u8>>) -> Self {
        debug_assert_eq!(clues.len(), grid.cells());
        State {
            grid,
            clues,
            lines: vec![Line::Unknown; grid.edges()],
            dot_yes: vec![0; grid.dots()],
            dot_no: vec![0; grid.dots()],
            face_yes: vec![0; grid.cells()],
            face_no: vec![0; grid.cells()],
            dot_solved: vec![false; grid.dots()],
            face_solved: vec![false; grid.cells()],
            dlines: vec![0; grid.dots() * 4],
        }
    }

    pub fn from_description(d: &Description) -> Self {
        let grid = Grid {
            w: d.width as usize,
            h: d.height as usize,
        };
        State::new(grid, d.clues.clone())
    }

    /// Port of `solver_set_line`: returns false if the edge already had
    /// that state. Never called to set an edge back to Unknown.
    pub fn set_line(&mut self, e: usize, new: Line) -> bool {
        debug_assert!(new != Line::Unknown);
        if self.lines[e] == new {
            return false;
        }
        debug_assert!(self.lines[e] == Line::Unknown);
        self.lines[e] = new;
        let (d1, d2) = self.grid.edge_dots(e);
        let faces = self.grid.edge_cells(e);
        let (dots, cells) = if new == Line::Yes {
            (&mut self.dot_yes, &mut self.face_yes)
        } else {
            (&mut self.dot_no, &mut self.face_no)
        };
        dots[d1] += 1;
        dots[d2] += 1;
        for f in faces.into_iter().flatten() {
            cells[f] += 1;
        }
        true
    }

    /// Number of edges at a dot.
    pub fn dot_order(&self, d: usize) -> u8 {
        self.grid.dot_edges(d).len() as u8
    }

    /// Index of the dline made of edge `k` and the next edge clockwise at
    /// dot `d`. A corner dot has only one pair, so both positions map to
    /// the same entry.
    pub fn dline_index(&self, d: usize, k: usize) -> usize {
        let k = if self.dot_order(d) == 2 { 0 } else { k };
        d * 4 + k
    }

    /// Port of `dline_index_from_face`: the dline at corner `k` of a cell,
    /// made of the cell's edges k-1 and k.
    pub fn dline_of_corner(&self, f: usize, k: usize) -> usize {
        let edges = self.grid.cell_edges(f);
        let (a, b) = (edges[(k + 3) % 4], edges[k]);
        let d = self.grid.cell_dots(f)[k];
        let de = self.grid.dot_edges(d);
        let n = de.len();
        for j in 0..n {
            let (e1, e2) = (de[j], de[(j + 1) % n]);
            if (e1 == a && e2 == b) || (e1 == b && e2 == a) {
                return self.dline_index(d, j);
            }
        }
        unreachable!("cell edges are always adjacent at their corner dot")
    }

    pub fn is_atleastone(&self, dl: usize) -> bool {
        self.dlines[dl] & DLINE_ATLEASTONE != 0
    }

    pub fn is_atmostone(&self, dl: usize) -> bool {
        self.dlines[dl] & DLINE_ATMOSTONE != 0
    }

    /// Returns true if the flag was newly set.
    pub fn set_atleastone(&mut self, dl: usize) -> bool {
        let was = self.is_atleastone(dl);
        self.dlines[dl] |= DLINE_ATLEASTONE;
        !was
    }

    pub fn set_atmostone(&mut self, dl: usize) -> bool {
        let was = self.is_atmostone(dl);
        self.dlines[dl] |= DLINE_ATMOSTONE;
        !was
    }

    /// Solution bytes: 1 per edge that is a line.
    pub fn line_bytes(&self) -> Vec<u8> {
        self.lines.iter().map(|&l| (l == Line::Yes) as u8).collect()
    }
}
