/// Disjoint set forest: the square-grid subset of Tatham's `dsf.c`, with
/// neither the flip nor the minimum-tracking variant. Union by size with
/// path compression on `find`.
///
/// The root choice matters for reproducibility, so it is fixed here
/// rather than left to each game: the larger class wins and ties go to
/// `b`, as the original does.
#[derive(Clone, Debug)]
pub struct Dsf {
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

    pub fn find(&mut self, i: usize) -> usize {
        let mut root = i;
        while self.parent[root] != root {
            root = self.parent[root];
        }
        let mut cur = i;
        while self.parent[cur] != root {
            let next = self.parent[cur];
            self.parent[cur] = root;
            cur = next;
        }
        root
    }

    pub fn merge(&mut self, a: usize, b: usize) {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb {
            return;
        }
        let (sa, sb) = (self.size[ra], self.size[rb]);
        let (big, small) = if sa > sb { (ra, rb) } else { (rb, ra) };
        self.parent[small] = big;
        self.size[big] = sa + sb;
    }

    pub fn equivalent(&mut self, a: usize, b: usize) -> bool {
        self.find(a) == self.find(b)
    }

    /// Number of elements in the class containing `i`.
    pub fn class_size(&mut self, i: usize) -> usize {
        let r = self.find(i);
        self.size[r]
    }
}
