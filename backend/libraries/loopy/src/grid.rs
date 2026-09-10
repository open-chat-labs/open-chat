/// Square grid geometry, written out directly instead of porting Tatham's
/// generic grid.c. Cells (his faces) are indexed y*w+x, dots (vertices)
/// y*(w+1)+x, and edges with every horizontal edge first — (h+1) rows of
/// w — then every vertical edge, h rows of (w+1).
#[derive(Clone, Copy, Debug)]
pub(crate) struct Grid {
    pub w: usize,
    pub h: usize,
}

/// The edges at a dot, clockwise from the top; two at a corner, three on
/// a border, four inside.
#[derive(Clone, Copy)]
pub(crate) struct DotEdges {
    edges: [usize; 4],
    len: usize,
}

impl std::ops::Deref for DotEdges {
    type Target = [usize];

    fn deref(&self) -> &[usize] {
        &self.edges[..self.len]
    }
}

impl Grid {
    pub fn cells(&self) -> usize {
        self.w * self.h
    }

    pub fn dots(&self) -> usize {
        (self.w + 1) * (self.h + 1)
    }

    pub fn horizontals(&self) -> usize {
        (self.h + 1) * self.w
    }

    pub fn edges(&self) -> usize {
        self.horizontals() + self.h * (self.w + 1)
    }

    pub fn cell(&self, x: usize, y: usize) -> usize {
        y * self.w + x
    }

    pub fn dot(&self, x: usize, y: usize) -> usize {
        y * (self.w + 1) + x
    }

    /// Horizontal edge along the top of cell (x, y); y may equal h.
    pub fn hedge(&self, x: usize, y: usize) -> usize {
        y * self.w + x
    }

    /// Vertical edge along the left of cell (x, y); x may equal w.
    pub fn vedge(&self, x: usize, y: usize) -> usize {
        self.horizontals() + y * (self.w + 1) + x
    }

    /// The two dots an edge joins: (left, right) or (top, bottom).
    pub fn edge_dots(&self, e: usize) -> (usize, usize) {
        let nh = self.horizontals();
        if e < nh {
            let (x, y) = (e % self.w, e / self.w);
            (self.dot(x, y), self.dot(x + 1, y))
        } else {
            let e = e - nh;
            let (x, y) = (e % (self.w + 1), e / (self.w + 1));
            (self.dot(x, y), self.dot(x, y + 1))
        }
    }

    /// The cells either side of an edge: (above, below) or (left, right);
    /// None is the outside of the grid.
    pub fn edge_cells(&self, e: usize) -> [Option<usize>; 2] {
        let nh = self.horizontals();
        if e < nh {
            let (x, y) = (e % self.w, e / self.w);
            [(y > 0).then(|| self.cell(x, y - 1)), (y < self.h).then(|| self.cell(x, y))]
        } else {
            let e = e - nh;
            let (x, y) = (e % (self.w + 1), e / (self.w + 1));
            [(x > 0).then(|| self.cell(x - 1, y)), (x < self.w).then(|| self.cell(x, y))]
        }
    }

    /// Edges of a cell clockwise from the top: top, right, bottom, left.
    pub fn cell_edges(&self, f: usize) -> [usize; 4] {
        let (x, y) = (f % self.w, f / self.w);
        [self.hedge(x, y), self.vedge(x + 1, y), self.hedge(x, y + 1), self.vedge(x, y)]
    }

    /// Corners of a cell clockwise from the top-left. Corner k sits
    /// between edge k-1 and edge k of `cell_edges`, as in grid.c.
    pub fn cell_dots(&self, f: usize) -> [usize; 4] {
        let (x, y) = (f % self.w, f / self.w);
        [self.dot(x, y), self.dot(x + 1, y), self.dot(x + 1, y + 1), self.dot(x, y + 1)]
    }

    pub fn dot_edges(&self, d: usize) -> DotEdges {
        let (x, y) = (d % (self.w + 1), d / (self.w + 1));
        let mut out = DotEdges { edges: [0; 4], len: 0 };
        let candidates = [
            (y > 0).then(|| self.vedge(x, y - 1)),
            (x < self.w).then(|| self.hedge(x, y)),
            (y < self.h).then(|| self.vedge(x, y)),
            (x > 0).then(|| self.hedge(x - 1, y)),
        ];
        for e in candidates.into_iter().flatten() {
            out.edges[out.len] = e;
            out.len += 1;
        }
        out
    }

    /// Orthogonal neighbours of a cell: up, right, down, left; None is
    /// the outside of the grid.
    pub fn cell_neighbours(&self, f: usize) -> [Option<usize>; 4] {
        let (x, y) = (f % self.w, f / self.w);
        [
            (y > 0).then(|| self.cell(x, y - 1)),
            (x + 1 < self.w).then(|| self.cell(x + 1, y)),
            (y + 1 < self.h).then(|| self.cell(x, y + 1)),
            (x > 0).then(|| self.cell(x - 1, y)),
        ]
    }

    /// The eight cells around a cell, clockwise from the top-left; None
    /// is the outside of the grid.
    pub fn cell_ring(&self, f: usize) -> [Option<usize>; 8] {
        let (x, y) = ((f % self.w) as i64, (f / self.w) as i64);
        const DELTAS: [(i64, i64); 8] = [(-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)];
        DELTAS.map(|(dx, dy)| {
            let (nx, ny) = (x + dx, y + dy);
            (nx >= 0 && ny >= 0 && nx < self.w as i64 && ny < self.h as i64).then(|| self.cell(nx as usize, ny as usize))
        })
    }
}
