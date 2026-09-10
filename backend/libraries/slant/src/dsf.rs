/// Minimal disjoint set forest (Tatham's `dsf.c` without the flip and
/// min-tracking variants): union by size with path compression.
#[derive(Clone)]
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

    pub fn canonify(&mut self, n: usize) -> usize {
        let mut root = n;
        while self.parent[root] != root {
            root = self.parent[root];
        }
        let mut cur = n;
        while self.parent[cur] != root {
            let next = self.parent[cur];
            self.parent[cur] = root;
            cur = next;
        }
        root
    }

    /// Same root choice as Tatham: the larger class wins, ties go to `b`.
    pub fn merge(&mut self, a: usize, b: usize) {
        let ra = self.canonify(a);
        let rb = self.canonify(b);
        if ra == rb {
            return;
        }
        let (sa, sb) = (self.size[ra], self.size[rb]);
        let root = if sa > sb { ra } else { rb };
        let child = if root == ra { rb } else { ra };
        self.parent[child] = root;
        self.size[root] = sa + sb;
    }

    pub fn equivalent(&mut self, a: usize, b: usize) -> bool {
        self.canonify(a) == self.canonify(b)
    }
}
