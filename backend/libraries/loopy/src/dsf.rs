/// Disjoint-set forest with union by size (the square-grid subset of
/// Tatham's dsf.c: no flip or min tracking).
pub(crate) struct Dsf {
    parent: Vec<usize>,
    size: Vec<usize>,
}

impl Dsf {
    pub fn new(n: usize) -> Self {
        Dsf {
            parent: (0..n).collect(),
            size: vec![1; n],
        }
    }

    pub fn find(&mut self, mut i: usize) -> usize {
        while self.parent[i] != i {
            self.parent[i] = self.parent[self.parent[i]];
            i = self.parent[i];
        }
        i
    }

    pub fn merge(&mut self, a: usize, b: usize) {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb {
            return;
        }
        let (big, small) = if self.size[ra] >= self.size[rb] { (ra, rb) } else { (rb, ra) };
        self.parent[small] = big;
        self.size[big] += self.size[small];
    }

    /// Number of elements in the set containing `i`.
    pub fn size(&mut self, i: usize) -> usize {
        let r = self.find(i);
        self.size[r]
    }
}
