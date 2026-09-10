use crate::rng::Rng;
use crate::solver::{Outcome, solve};
use crate::state::{MAX_BRIDGES, State};
use crate::{Description, Generated, Params, Tier, encode_description, solution_pairs, solve_with_trace};

const MAX_NEWISLAND_TRIES: usize = 50;
const MIN_SENSIBLE_ISLANDS: usize = 3;
/// Tatham loops forever; a canister must not, so give up eventually.
const MAX_ATTEMPTS: usize = 100_000;

const WATER: u8 = 0;
const ISLAND: u8 = 1;
const LINE_H: u8 = 2;
const LINE_V: u8 = 3;

/// The grid being built by `new_game_desc`: islands and the bridges laid
/// between them, before any solving.
struct Layout {
    w: i32,
    h: i32,
    cell: Vec<u8>,
    lines: Vec<u8>,
    islands: Vec<(i32, i32)>,
}

enum Step {
    Bad,
    Join(usize),
    New(i32, i32),
}

impl Layout {
    fn new(w: usize, h: usize) -> Self {
        Layout {
            w: w as i32,
            h: h as i32,
            cell: vec![WATER; w * h],
            lines: vec![0; w * h],
            islands: Vec::new(),
        }
    }

    fn in_grid(&self, x: i32, y: i32) -> bool {
        x >= 0 && x < self.w && y >= 0 && y < self.h
    }

    fn at(&self, x: i32, y: i32) -> u8 {
        self.cell[(y * self.w + x) as usize]
    }

    fn is_island_in(&self, x: i32, y: i32) -> bool {
        self.in_grid(x, y) && self.at(x, y) == ISLAND
    }

    fn add_island(&mut self, x: i32, y: i32) -> usize {
        self.cell[(y * self.w + x) as usize] = ISLAND;
        self.islands.push((x, y));
        self.islands.len() - 1
    }

    /// Port of `island_join` for a real (non-max) join.
    fn join(&mut self, i: usize, j: usize, n: u8) {
        let (x1, y1) = self.islands[i];
        let (x2, y2) = self.islands[j];
        if x1 == x2 {
            for y in y1.min(y2) + 1..y1.max(y2) {
                let c = (y * self.w + x1) as usize;
                self.cell[c] = LINE_V;
                self.lines[c] = n;
            }
        } else {
            for x in x1.min(x2) + 1..x1.max(x2) {
                let c = (y1 * self.w + x) as usize;
                self.cell[c] = LINE_H;
                self.lines[c] = n;
            }
        }
    }

    /// In-grid directions from an island in Tatham's order: left, right,
    /// up, down.
    fn dirs(&self, x: i32, y: i32) -> Vec<(i32, i32)> {
        let mut out = Vec::with_capacity(4);
        if x > 0 {
            out.push((-1, 0));
        }
        if x < self.w - 1 {
            out.push((1, 0));
        }
        if y > 0 {
            out.push((0, -1));
        }
        if y < self.h - 1 {
            out.push((0, 1));
        }
        out
    }

    /// One iteration of the island-placing loop in `new_game_desc`.
    fn pick_step(&self, rng: &mut Rng, i: usize, expansion: u8) -> Step {
        let (ix, iy) = self.islands[i];
        let dirs = self.dirs(ix, iy);
        let (dx, dy) = dirs[rng.below(dirs.len())];
        let (minx, miny) = (ix + 2 * dx, iy + 2 * dy);
        let (mut x, mut y) = (ix + dx, iy + dy);
        if matches!(self.at(x, y), LINE_H | LINE_V) {
            return Step::Bad;
        }
        let mut join = None;
        let (maxx, maxy);
        loop {
            if !self.in_grid(x, y) {
                maxx = x - dx;
                maxy = y - dy;
                break;
            }
            match self.at(x, y) {
                ISLAND => {
                    join = self.islands.iter().position(|&p| p == (x, y));
                    maxx = x - 2 * dx;
                    maxy = y - 2 * dy;
                    break;
                }
                LINE_H | LINE_V => {
                    maxx = x - dx;
                    maxy = y - dy;
                    break;
                }
                _ => {}
            }
            x += dx;
            y += dy;
        }
        if let Some(j) = join
            && rng.below(100) < expansion as usize
        {
            return Step::Join(j);
        }
        let diffx = (maxx - minx) * dx;
        let diffy = (maxy - miny) * dy;
        if diffx < 0 || diffy < 0 {
            return Step::Bad;
        }
        let (nx, ny) = if rng.below(100) < expansion as usize {
            (maxx, maxy)
        } else {
            let px = minx + rng.below(diffx as usize + 1) as i32 * dx;
            let py = miny + rng.below(diffy as usize + 1) as i32 * dy;
            (px, py)
        };
        if self.is_island_in(nx + dy, ny + dx) || self.is_island_in(nx - dy, ny - dx) {
            return Step::Bad;
        }
        Step::New(nx, ny)
    }

    /// Port of the edge check in `new_game_desc`: an island on every side.
    fn touches_all_sides(&self) -> bool {
        let top = (0..self.w).any(|x| self.at(x, 0) == ISLAND);
        let bottom = (0..self.w).any(|x| self.at(x, self.h - 1) == ISLAND);
        let left = (0..self.h).any(|y| self.at(0, y) == ISLAND);
        let right = (0..self.h).any(|y| self.at(self.w - 1, y) == ISLAND);
        top && bottom && left && right
    }

    /// Port of `map_count`: each island's number is the bridges touching it.
    fn description(&self) -> Description {
        let mut cells = vec![0u8; (self.w * self.h) as usize];
        for &(x, y) in &self.islands {
            let mut count = 0;
            for (dx, dy, line) in [(-1, 0, LINE_H), (1, 0, LINE_H), (0, -1, LINE_V), (0, 1, LINE_V)] {
                let (nx, ny) = (x + dx, y + dy);
                if self.in_grid(nx, ny) && self.at(nx, ny) == line {
                    count += self.lines[(ny * self.w + nx) as usize];
                }
            }
            cells[(y * self.w + x) as usize] = count;
        }
        Description {
            width: self.w as u8,
            height: self.h as u8,
            cells,
        }
    }

    fn solution(&self) -> Vec<u8> {
        self.cell
            .iter()
            .zip(&self.lines)
            .map(|(&c, &n)| match c {
                LINE_H => n,
                LINE_V => 2 + n,
                _ => 0,
            })
            .collect()
    }
}

/// Port of the island-placing half of `new_game_desc`: grow a connected
/// set of islands from a random start, joining each new one to its parent
/// with a random number of bridges.
fn build(rng: &mut Rng, w: usize, h: usize, ni_req: usize, expansion: u8) -> Layout {
    let mut l = Layout::new(w, h);
    let x = rng.below(w) as i32;
    let y = rng.below(h) as i32;
    l.add_island(x, y);
    let mut ni_bad = 0;
    while l.islands.len() < ni_req {
        let i = rng.below(l.islands.len());
        match l.pick_step(rng, i, expansion) {
            Step::Bad => {
                ni_bad += 1;
                if ni_bad > MAX_NEWISLAND_TRIES {
                    break;
                }
            }
            Step::Join(j) => {
                let n = rng.below(MAX_BRIDGES as usize) as u8 + 1;
                l.join(i, j, n);
            }
            Step::New(nx, ny) => {
                let j = l.add_island(nx, ny);
                ni_bad = 0;
                let n = rng.below(MAX_BRIDGES as usize) as u8 + 1;
                l.join(i, j, n);
            }
        }
    }
    l
}

fn solvable(st: &State, tier: Tier) -> Option<Vec<u8>> {
    let mut st = st.clone();
    st.clear();
    (solve(&mut st, tier, None) == Outcome::Solved).then(|| st.to_grid())
}

/// Port of `new_game_desc`. Bridges has no clues to strip: every island
/// carries its number, so a layout is kept or rejected as a whole.
pub(crate) fn generate(seed: u64, params: Params) -> Generated {
    let (w, h) = (params.width as usize, params.height as usize);
    assert!(w >= 3 && h >= 3, "width and height must be at least 3");
    assert!(w * h <= 32767, "grid too large for u16 edge keys");
    assert!((1..=30).contains(&params.island_pct), "island_pct must be between 1 and 30");
    assert!(params.expansion_pct <= 100, "expansion_pct must be at most 100");
    let tier = params.tier;
    let ni_req = (params.island_pct as usize * w * h / 100).max(MIN_SENSIBLE_ISLANDS);
    let mut rng = Rng::new(seed);

    for _ in 0..MAX_ATTEMPTS {
        let layout = build(&mut rng, w, h, ni_req, params.expansion_pct);
        if layout.islands.len() == 1 || !layout.touches_all_sides() {
            continue;
        }
        let d = layout.description();
        let st = State::from_description(&d);
        if tier == Tier::Tricky && solvable(&st, Tier::Easy).is_some() {
            continue;
        }
        let Some(solved) = solvable(&st, tier) else {
            continue;
        };
        let solution = layout.solution();
        if solved != solution {
            // Every technique is sound, so this cannot happen; skip the
            // layout rather than trust it if it ever does.
            continue;
        }
        let description = encode_description(&d);
        let (hints, _) = solve_with_trace(&description, tier);
        let pairs = solution_pairs(&description, &solution);
        return Generated {
            description,
            solution,
            hints,
            pairs,
            tier,
        };
    }
    panic!("no {tier:?} bridges puzzle of {w}x{h} found for seed {seed}");
}
