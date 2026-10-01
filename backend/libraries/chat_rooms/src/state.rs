use crate::Description;

/// The fixed shape of a puzzle: its rooms and the groups every rule talks
/// about. Group `g` is row `g` for `g < n`, column `g - n` for `g < 2n`,
/// and room `g - 2n` after that; each must end up holding one logo.
pub(crate) struct Board {
    pub n: usize,
    pub rooms: Vec<u8>,
    pub groups: Vec<Vec<usize>>,
    /// Per cell, every other cell a logo there rules out: its row, column
    /// and room, and the eight cells around it. Sorted.
    pub shadows: Vec<Vec<usize>>,
}

impl Board {
    pub fn new(d: &Description) -> Self {
        Board::from_rooms(d.size as usize, d.rooms.clone())
    }

    pub fn from_rooms(n: usize, rooms: Vec<u8>) -> Self {
        let mut groups = vec![Vec::new(); 3 * n];
        for (i, &room) in rooms.iter().enumerate() {
            groups[i / n].push(i);
            groups[n + i % n].push(i);
            groups[2 * n + room as usize].push(i);
        }
        let mut board = Board {
            n,
            rooms,
            groups,
            shadows: Vec::new(),
        };
        board.shadows = (0..n * n).map(|i| board.shadow_of(i)).collect();
        board
    }

    /// Row, column and room group of cell `i`.
    pub fn groups_of(&self, i: usize) -> [usize; 3] {
        let n = self.n;
        [i / n, n + i % n, 2 * n + self.rooms[i] as usize]
    }

    fn shadow_of(&self, i: usize) -> Vec<usize> {
        let mut out: Vec<usize> = self
            .groups_of(i)
            .iter()
            .flat_map(|&g| self.groups[g].iter().copied())
            .collect();
        out.extend(self.around(i));
        out.sort_unstable();
        out.dedup();
        out.retain(|&j| j != i);
        out
    }

    /// The up to eight cells touching `i`, diagonals included.
    pub fn around(&self, i: usize) -> impl Iterator<Item = usize> + '_ {
        let n = self.n as isize;
        let (x, y) = ((i as isize) % n, (i as isize) / n);
        (-1..=1)
            .flat_map(move |dy| (-1..=1).map(move |dx| (x + dx, y + dy)))
            .filter(move |&(nx, ny)| (nx, ny) != (x, y) && (0..n).contains(&nx) && (0..n).contains(&ny))
            .map(move |(nx, ny)| (ny * n + nx) as usize)
    }

    /// The touching cells after `i` in reading order, so each touching pair
    /// is visited once.
    pub fn touching_after(&self, i: usize) -> impl Iterator<Item = usize> + '_ {
        self.around(i).filter(move |&j| j > i)
    }
}
