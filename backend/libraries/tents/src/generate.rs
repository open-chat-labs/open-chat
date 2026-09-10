use crate::rng::Rng;
use crate::solver::{Outcome, solve};
use crate::state::{Square, State};
use crate::{Generated, Params, Tier, encode_description, solution_pairs, solve_with_trace};

const NONE: usize = usize::MAX;

/// Port of `matching_with_scratch` (Hopcroft-Karp, randomised when `rng`
/// is given): a maximum matching between `nl` left vertices and `nr`
/// right vertices. `adj[l]` lists the right neighbours of `l` and is
/// reordered in place, as the original does. Returns the matching size
/// and, for every right vertex, its left partner or `NONE`.
fn matching(nl: usize, nr: usize, adj: &mut [Vec<usize>], mut rng: Option<&mut Rng>) -> (usize, Vec<usize>) {
    let nmin = nl.min(nr);
    let mut l_to_r = vec![NONE; nl];
    let mut r_to_l = vec![NONE; nr];
    let mut l_layer = vec![-1i32; nl];
    let mut r_layer = vec![-1i32; nr];
    let mut l_queue = Vec::with_capacity(nl);
    let mut r_queue = Vec::with_capacity(nr);
    let mut aug_path = vec![0usize; 2 * nmin + 2];
    let mut dfs_state = vec![0usize; nmin + 2];
    let mut l_order: Vec<usize> = (0..nl).collect();

    'outer: loop {
        l_layer.fill(-1);
        r_layer.fill(-1);
        l_queue.clear();
        for l in 0..nl {
            if l_to_r[l] == NONE {
                l_layer[l] = 0;
                l_queue.push(l);
            }
        }

        let mut layer = 0;
        loop {
            let mut found_free_r = false;
            r_queue.clear();
            for &l in &l_queue {
                for &r in &adj[l] {
                    if r != l_to_r[l] && r_layer[r] == -1 {
                        r_layer[r] = layer + 1;
                        r_queue.push(r);
                        if r_to_l[r] == NONE {
                            found_free_r = true;
                        }
                    }
                }
            }
            layer += 1;
            if found_free_r {
                break;
            }
            if r_queue.is_empty() {
                break 'outer;
            }
            l_queue.clear();
            for &r in &r_queue {
                let l = r_to_l[r];
                if l != NONE && l_layer[l] == -1 {
                    l_layer[l] = layer + 1;
                    l_queue.push(l);
                }
            }
            layer += 1;
            if l_queue.is_empty() {
                break 'outer;
            }
        }
        let target_layer = layer;

        for r in 0..nr {
            if r_layer[r] == target_layer && r_to_l[r] != NONE {
                r_layer[r] = -1;
            }
        }

        for (i, l) in l_order.iter_mut().enumerate() {
            *l = i;
        }
        if let Some(rng) = rng.as_deref_mut() {
            rng.shuffle(&mut l_order);
        }

        dfs_state[0] = 0;
        let mut i = 0usize;
        loop {
            let l;
            if i == 0 {
                if dfs_state[0] == nl {
                    break;
                }
                l = l_order[dfs_state[0]];
                dfs_state[0] += 1;
                if l_layer[l] != 0 {
                    continue;
                }
            } else {
                let prev = aug_path[2 * i - 2];
                let j = dfs_state[i];
                dfs_state[i] += 1;
                if j == adj[prev].len() {
                    i -= 1;
                    continue;
                }
                if let Some(rng) = rng.as_deref_mut()
                    && adj[prev].len() - j > 1
                {
                    let which = j + rng.below(adj[prev].len() - j);
                    adj[prev].swap(which, j);
                }
                let r = adj[prev][j];
                if r_layer[r] != (2 * i - 1) as i32 {
                    continue;
                }
                aug_path[2 * i - 1] = r;
                r_layer[r] = -1;
                if (2 * i - 1) as i32 == target_layer {
                    for j in (0..2 * i).step_by(2) {
                        l_to_r[aug_path[j]] = aug_path[j + 1];
                        r_to_l[aug_path[j + 1]] = aug_path[j];
                    }
                    i = 0;
                    continue;
                }
                l = r_to_l[r];
                if l_layer[l] != (2 * i) as i32 {
                    continue;
                }
            }
            aug_path[2 * i] = l;
            l_layer[l] = -1;
            i += 1;
            dfs_state[i] = 0;
        }
    }

    let size = l_to_r.iter().filter(|&&r| r != NONE).count();
    (size, r_to_l)
}

/// Port of `new_game_desc`: place the tents at random without any two
/// touching, place a tree beside each one via a random maximum matching,
/// then keep the layout only if the solver at the requested tier finishes
/// and (for Tricky) the tier below does not. Tents has no clue stripping:
/// the trees are the solution and every line count is always given.
pub(crate) fn generate(seed: u64, params: Params) -> Generated {
    let (w, h) = (params.width as usize, params.height as usize);
    assert!(w >= 4 && h >= 4, "width and height must be at least 4");
    assert!((1..=25).contains(&params.tree_pct), "tree_pct must be between 1 and 25");
    let n = w * h;
    let ntrees = n * params.tree_pct as usize / 100;
    // Tatham downgrades to Easy on tiny grids to avoid a tight loop.
    let tier = if params.tier == Tier::Tricky && w <= 4 && h <= 4 { Tier::Easy } else { params.tier };
    let mut rng = Rng::new(seed);

    loop {
        let mut order: Vec<usize> = (0..n).collect();
        let mut treemap = vec![NONE; n];
        let mut grid = vec![Square::Blank; n];
        let mut st = State::new(w, h);

        // Place tents at random without making any two adjacent.
        let mut left = ntrees;
        let mut nr = 0;
        let mut i = 0;
        while left > 0 && i + left <= n {
            let which = i + rng.below(n - i);
            order.swap(which, i);
            let cell = order[i];
            if !st.around(cell).any(|j| grid[j] == Square::Tent) {
                grid[cell] = Square::Tent;
                for (_, j) in st.neighbours(cell) {
                    if treemap[j] == NONE {
                        treemap[j] = nr;
                        nr += 1;
                    }
                }
                left -= 1;
            }
            i += 1;
        }
        if left > 0 {
            continue;
        }

        // One left vertex per tent (row-major), joined to the potential
        // tree squares around it.
        let mut adj: Vec<Vec<usize>> = (0..n)
            .filter(|&c| grid[c] == Square::Tent)
            .map(|c| st.neighbours(c).map(|(_, j)| treemap[j]).collect())
            .collect();
        let (matched, outr) = matching(ntrees, nr, &mut adj, Some(&mut rng));
        if matched < ntrees {
            continue;
        }
        for c in 0..n {
            if treemap[c] != NONE && outr[treemap[c]] != NONE {
                grid[c] = Square::Tree;
            }
        }

        // Every row and column must contain a tent or a tree.
        let empty_column = (0..w).any(|x| (0..h).all(|y| grid[y * w + x] == Square::Blank));
        let empty_row = (0..h).any(|y| (0..w).all(|x| grid[y * w + x] == Square::Blank));
        if empty_column || empty_row {
            continue;
        }

        for x in 0..w {
            st.numbers[x] = (0..h).filter(|&y| grid[y * w + x] == Square::Tent).count() as u8;
        }
        for y in 0..h {
            st.numbers[w + y] = (0..w).filter(|&x| grid[y * w + x] == Square::Tent).count() as u8;
        }
        for (sq, &g) in st.grid.iter_mut().zip(&grid) {
            *sq = if g == Square::Tree { Square::Tree } else { Square::Blank };
        }

        if tier == Tier::Tricky && solve(&mut st.clone(), Tier::Easy, None) == Outcome::Solved {
            continue;
        }
        let mut solved = st.clone();
        if solve(&mut solved, tier, None) != Outcome::Solved {
            continue;
        }
        let solution: Vec<u8> = grid.iter().map(|&s| (s == Square::Tent) as u8).collect();
        debug_assert_eq!(solved.tents(), solution);

        let description = encode_description(&st);
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
}
