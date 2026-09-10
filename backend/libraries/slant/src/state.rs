use crate::Description;

/// Working grid. `clues` is the (w+1)*(h+1) vertex grid, `soln` the w*h
/// cell grid using Tatham's convention: -1 backslash, +1 slash, 0 unknown.
#[derive(Clone)]
pub(crate) struct State {
    pub w: usize,
    pub h: usize,
    pub clues: Vec<Option<u8>>,
    pub soln: Vec<i8>,
}

impl State {
    pub fn new(w: usize, h: usize) -> Self {
        State {
            w,
            h,
            clues: vec![None; (w + 1) * (h + 1)],
            soln: vec![0; w * h],
        }
    }

    pub fn from_description(d: &Description) -> Self {
        State {
            w: d.width as usize,
            h: d.height as usize,
            clues: d.clues.clone(),
            soln: vec![0; d.width as usize * d.height as usize],
        }
    }

    pub fn size(&self) -> usize {
        self.w * self.h
    }

    /// Width of the vertex grid (Tatham's `W`).
    pub fn vw(&self) -> usize {
        self.w + 1
    }

    pub fn vertices(&self) -> usize {
        (self.w + 1) * (self.h + 1)
    }

    /// Cells around vertex (vx, vy) in Tatham's order (top-left,
    /// bottom-left, bottom-right, top-right), each with the slash value
    /// that would connect that cell to the vertex. Returns the array and
    /// how many entries are valid.
    pub fn vertex_neighbours(&self, vx: usize, vy: usize) -> ([(usize, i8); 4], usize) {
        let (w, h) = (self.w, self.h);
        let mut out = [(0usize, 0i8); 4];
        let mut n = 0;
        if vx > 0 && vy > 0 {
            out[n] = ((vy - 1) * w + (vx - 1), -1);
            n += 1;
        }
        if vx > 0 && vy < h {
            out[n] = (vy * w + (vx - 1), 1);
            n += 1;
        }
        if vx < w && vy < h {
            out[n] = (vy * w + vx, -1);
            n += 1;
        }
        if vx < w && vy > 0 {
            out[n] = ((vy - 1) * w + vx, 1);
            n += 1;
        }
        (out, n)
    }

    /// The two vertices joined by slash `v` in cell `i`.
    pub fn endpoints(&self, i: usize, v: i8) -> (usize, usize) {
        let vw = self.vw();
        let (x, y) = (i % self.w, i / self.w);
        if v < 0 { (y * vw + x, (y + 1) * vw + (x + 1)) } else { (y * vw + (x + 1), (y + 1) * vw + x) }
    }

    pub fn filled(&self) -> bool {
        self.soln.iter().all(|&v| v != 0)
    }

    /// Vertices reachable from `v` along placed diagonals, each with the
    /// cell that carries the diagonal.
    fn adjacent(&self, v: usize) -> impl Iterator<Item = (usize, usize)> {
        let (w, h, vw) = (self.w, self.h, self.vw());
        let (vx, vy) = (v % vw, v / vw);
        let cell = |cx: usize, cy: usize| cy * w + cx;
        [
            (vx < w && vy < h && self.soln[cell(vx, vy)] < 0).then(|| ((vy + 1) * vw + vx + 1, cell(vx, vy))),
            (vx > 0 && vy > 0 && self.soln[cell(vx - 1, vy - 1)] < 0).then(|| ((vy - 1) * vw + vx - 1, cell(vx - 1, vy - 1))),
            (vx > 0 && vy < h && self.soln[cell(vx - 1, vy)] > 0).then(|| ((vy + 1) * vw + vx - 1, cell(vx - 1, vy))),
            (vx < w && vy > 0 && self.soln[cell(vx, vy - 1)] > 0).then(|| ((vy - 1) * vw + vx + 1, cell(vx, vy - 1))),
        ]
        .into_iter()
        .flatten()
    }

    /// Cells along the path of placed diagonals from vertex `a` to vertex
    /// `b` (unique while the diagonals form a forest); empty if there is
    /// none.
    pub fn path_cells(&self, a: usize, b: usize) -> Vec<usize> {
        let mut prev: Vec<Option<(usize, usize)>> = vec![None; self.vertices()];
        let mut queue = std::collections::VecDeque::new();
        prev[a] = Some((a, usize::MAX));
        queue.push_back(a);
        while let Some(v) = queue.pop_front() {
            if v == b {
                break;
            }
            for (next, cell) in self.adjacent(v) {
                if prev[next].is_none() {
                    prev[next] = Some((v, cell));
                    queue.push_back(next);
                }
            }
        }
        let mut out = Vec::new();
        let mut cur = b;
        while let Some((p, cell)) = prev[cur] {
            if cur == a {
                break;
            }
            out.push(cell);
            cur = p;
        }
        if cur != a {
            return Vec::new();
        }
        out.reverse();
        out
    }
}
