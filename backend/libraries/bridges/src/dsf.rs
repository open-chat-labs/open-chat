/// Minimal disjoint set forest (Tatham's dsf.c without the flip and
/// minimum tracking): path compression on find, union by size.
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
        let mut root = i;
        while self.parent[root] != root {
            root = self.parent[root];
        }
        while self.parent[i] != root {
            let next = self.parent[i];
            self.parent[i] = root;
            i = next;
        }
        root
    }

    pub fn merge(&mut self, a: usize, b: usize) {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb {
            return;
        }
        let (big, small) = if self.size[ra] > self.size[rb] { (ra, rb) } else { (rb, ra) };
        self.parent[small] = big;
        self.size[big] += self.size[small];
    }
}
