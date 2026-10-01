use crate::{Description, MAX_SIZE};

// Every cell of the largest board has a bit in a `u128`
const _: () = assert!(MAX_SIZE * MAX_SIZE <= u128::BITS as usize);

/// The fixed shape of a puzzle: its rooms and the groups every rule talks
/// about. Group `g` is row `g` for `g < n`, column `g - n` for `g < 2n`,
/// and room `g - 2n` after that; each must end up holding one logo.
pub(crate) struct Board {
    pub n: usize,
    pub rooms: Vec<u8>,
    pub groups: Vec<Vec<usize>>,
    /// Per cell, every other cell a logo there rules out: its row, column
    /// and room, and the eight cells around it. Cell `j` is bit `j`.
    pub shadows: Vec<u128>,
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
        let masks: Vec<u128> = groups.iter().map(|g| g.iter().fold(0, |m, &i| m | 1 << i)).collect();
        let mut board = Board {
            n,
            rooms,
            groups,
            shadows: Vec::new(),
        };
        board.shadows = (0..n * n)
            .map(|i| {
                let around = board.around(i).fold(0, |m, j| m | 1 << j);
                let [row, column, room] = board.groups_of(i);
                (masks[row] | masks[column] | masks[room] | around) & !(1 << i)
            })
            .collect();
        board
    }

    /// Row, column and room group of cell `i`.
    pub fn groups_of(&self, i: usize) -> [usize; 3] {
        let n = self.n;
        [i / n, n + i % n, 2 * n + self.rooms[i] as usize]
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

/// The cells of `mask`, lowest first.
pub(crate) fn cells(mut mask: u128) -> impl Iterator<Item = usize> {
    std::iter::from_fn(move || {
        (mask != 0).then(|| {
            let i = mask.trailing_zeros() as usize;
            mask &= mask - 1;
            i
        })
    })
}
