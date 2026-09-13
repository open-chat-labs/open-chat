use crate::Description;
use puzzle_core::Dsf;

/// Tatham's `maxb`; the wire format only encodes 0..=2 bridges per pair.
pub(crate) const MAX_BRIDGES: u8 = 2;

#[derive(Clone, Debug)]
pub(crate) struct Island {
    pub cell: usize,
    pub count: u8,
    /// Edge to the nearest island left, right, up, down (Tatham's
    /// `surrounds` order); None where the grid edge comes first.
    pub edges: [Option<usize>; 4],
}

/// A pair of islands with only water between them: a place bridges can go.
#[derive(Clone, Debug)]
pub(crate) struct Edge {
    /// Left / top island.
    pub a: usize,
    /// Right / bottom island.
    pub b: usize,
    pub horizontal: bool,
    /// The water cells between the islands, nearest `a` first.
    pub cells: Vec<usize>,
    /// Edges of the other orientation sharing a cell with this one.
    pub crossings: Vec<usize>,
    /// Wire key: `a.cell * 2 + dir`, dir 0 = right, 1 = down.
    pub key: u16,
}

/// Working state: the port of Tatham's `game_state` with the bridge
/// squares folded into per-edge values (the rewrite he describes at the
/// top of bridges.c). `lines` is his per-square line count, `max` his
/// MAXIMUM, `marked` his G_MARK on a full island.
#[derive(Clone)]
pub(crate) struct State {
    pub w: usize,
    pub h: usize,
    pub islands: Vec<Island>,
    pub edges: Vec<Edge>,
    pub cell_island: Vec<Option<usize>>,
    pub lines: Vec<u8>,
    pub max: Vec<u8>,
    pub marked: Vec<bool>,
}

impl State {
    pub fn from_description(d: &Description) -> Self {
        let (w, h) = (d.width as usize, d.height as usize);
        let n = w * h;
        let mut cell_island = vec![None; n];
        let mut islands = Vec::new();
        for (i, &count) in d.cells.iter().enumerate() {
            if count > 0 {
                cell_island[i] = Some(islands.len());
                islands.push(Island {
                    cell: i,
                    count,
                    edges: [None; 4],
                });
            }
        }

        let mut edges: Vec<Edge> = Vec::new();
        let mut h_at = vec![None; n];
        let mut v_at = vec![None; n];
        for a in 0..islands.len() {
            let cell = islands[a].cell;
            let (x, y) = (cell % w, cell / w);
            let mut cells = Vec::new();
            for cx in x + 1..w {
                let c = y * w + cx;
                if let Some(b) = cell_island[c] {
                    let e = edges.len();
                    for &c in &cells {
                        h_at[c] = Some(e);
                    }
                    edges.push(Edge {
                        a,
                        b,
                        horizontal: true,
                        cells,
                        crossings: Vec::new(),
                        key: (cell * 2) as u16,
                    });
                    islands[a].edges[1] = Some(e);
                    islands[b].edges[0] = Some(e);
                    break;
                }
                cells.push(c);
            }
            let mut cells = Vec::new();
            for cy in y + 1..h {
                let c = cy * w + x;
                if let Some(b) = cell_island[c] {
                    let e = edges.len();
                    for &c in &cells {
                        v_at[c] = Some(e);
                    }
                    edges.push(Edge {
                        a,
                        b,
                        horizontal: false,
                        cells,
                        crossings: Vec::new(),
                        key: (cell * 2 + 1) as u16,
                    });
                    islands[a].edges[3] = Some(e);
                    islands[b].edges[2] = Some(e);
                    break;
                }
                cells.push(c);
            }
        }
        for c in 0..n {
            if let (Some(he), Some(ve)) = (h_at[c], v_at[c]) {
                edges[he].crossings.push(ve);
                edges[ve].crossings.push(he);
            }
        }

        let (ni, ne) = (islands.len(), edges.len());
        State {
            w,
            h,
            islands,
            edges,
            cell_island,
            lines: vec![0; ne],
            max: vec![MAX_BRIDGES; ne],
            marked: vec![false; ni],
        }
    }

    pub fn size(&self) -> usize {
        self.w * self.h
    }

    /// Port of `map_clear`: back to the bare puzzle.
    pub fn clear(&mut self) {
        self.lines.iter_mut().for_each(|l| *l = 0);
        self.max.iter_mut().for_each(|m| *m = MAX_BRIDGES);
        self.marked.iter_mut().for_each(|m| *m = false);
    }

    pub fn island_edges(&self, i: usize) -> impl Iterator<Item = usize> + use<> {
        self.islands[i].edges.into_iter().flatten()
    }

    pub fn other_end(&self, e: usize, i: usize) -> usize {
        let edge = &self.edges[e];
        if edge.a == i { edge.b } else { edge.a }
    }

    /// Port of `island_countbridges`.
    pub fn bridges(&self, i: usize) -> u8 {
        self.island_edges(i).map(|e| self.lines[e]).sum()
    }

    /// Port of Tatham's POSSIBLES for the squares of this edge: zero when a
    /// bridge of the other orientation crosses it, else the smaller island
    /// number capped by MAXIMUM. Note it ignores bridges already placed.
    pub fn possible(&self, e: usize) -> u8 {
        let edge = &self.edges[e];
        if edge.crossings.iter().any(|&c| self.lines[c] > 0) {
            return 0;
        }
        self.islands[edge.a].count.min(self.islands[edge.b].count).min(self.max[e])
    }

    /// Tatham's G_MARK on the squares of this edge: either end is full.
    fn mark_blocked(&self, e: usize) -> bool {
        let edge = &self.edges[e];
        self.marked[edge.a] || self.marked[edge.b]
    }

    /// Port of `island_adjspace` with marks on.
    pub fn adjspace(&self, e: usize, missing: u8) -> u8 {
        if self.mark_blocked(e) {
            return 0;
        }
        self.possible(e).min(missing).min(self.max[e] - self.lines[e])
    }

    /// Port of `island_isadj`: a bridge count, not a boolean.
    pub fn isadj(&self, e: usize) -> u8 {
        if self.mark_blocked(e) { self.lines[e] } else { self.possible(e) }
    }

    /// Port of `island_countspaces` with marks on.
    pub fn countspaces(&self, i: usize) -> u8 {
        let Some(missing) = self.islands[i].count.checked_sub(self.bridges(i)) else {
            return 0;
        };
        self.island_edges(i).map(|e| self.adjspace(e, missing)).sum()
    }

    /// Port of `island_countadj`.
    pub fn countadj(&self, i: usize) -> u8 {
        self.island_edges(i).filter(|&e| self.isadj(e) > 0).count() as u8
    }

    /// Upper bound on the final bridge count of an edge: POSSIBLES, and
    /// what each end could still take. Tighter than anything the
    /// technique solver uses; it only decides when a conclusion is final.
    pub fn cap(&self, e: usize) -> u8 {
        let edge = &self.edges[e];
        let room = |i: usize| {
            let others = self.bridges(i) - self.lines[e];
            self.islands[i].count.saturating_sub(others)
        };
        self.possible(e).min(room(edge.a)).min(room(edge.b))
    }

    /// No sound completion can change this edge any more.
    pub fn is_final(&self, e: usize) -> bool {
        self.mark_blocked(e) || self.lines[e] >= self.cap(e)
    }

    pub fn all_full(&self) -> bool {
        (0..self.islands.len()).all(|i| self.bridges(i) == self.islands[i].count)
    }

    pub fn connected(&self) -> bool {
        if self.islands.is_empty() {
            return true;
        }
        let mut dsf = Dsf::new(self.islands.len());
        for (e, edge) in self.edges.iter().enumerate() {
            if self.lines[e] > 0 {
                dsf.merge(edge.a, edge.b);
            }
        }
        let root = dsf.find(0);
        (1..self.islands.len()).all(|i| dsf.find(i) == root)
    }

    /// Port of `map_check` with loops allowed.
    pub fn solved(&self) -> bool {
        self.all_full() && self.connected()
    }

    /// Solution bytes: 0 nothing, 1/2 horizontal, 3/4 vertical.
    pub fn to_grid(&self) -> Vec<u8> {
        let mut out = vec![0u8; self.size()];
        for (e, edge) in self.edges.iter().enumerate() {
            let n = self.lines[e];
            if n == 0 {
                continue;
            }
            let byte = if edge.horizontal { n } else { 2 + n };
            for &c in &edge.cells {
                out[c] = byte;
            }
        }
        out
    }
}
