use crate::rng::Rng;
use crate::solver::{Outcome, solve};
use crate::state::State;
use crate::{Generated, Params, Symmetry, Tier, encode_description, solution_pairs, solve_with_trace};

const MAX_GRIDGEN_TRIES: usize = 20;

/// Port of `set_blacks`: randomise a fundamental region, then copy it out
/// under the requested symmetry.
fn set_blacks(w: usize, h: usize, symmetry: Symmetry, black_pct: u8, rng: &mut Rng) -> State {
    let mut st = State::new(w, h);
    let (degree, rotate) = match symmetry {
        Symmetry::None => (1, false),
        Symmetry::Rot2 => (2, true),
        Symmetry::Ref2 => (2, false),
        Symmetry::Rot4 => (4, true),
        Symmetry::Ref4 => (4, false),
    };
    let wodd = w % 2;
    let hodd = h % 2;
    let (rw, rh) = match degree {
        4 => (w / 2 + if rotate { 0 } else { wodd }, h / 2 + hodd),
        2 => (w, h / 2 + hodd),
        _ => (w, h),
    };

    let nblack = rw * rh * black_pct as usize / 100;
    for _ in 0..nblack {
        loop {
            let x = rng.below(rw);
            let y = rng.below(rh);
            if !st.black[y * w + x] {
                st.black[y * w + x] = true;
                break;
            }
        }
    }

    if degree == 1 {
        return st;
    }
    for x in 0..rw {
        for y in 0..rh {
            let src = st.black[y * w + x];
            let images: [(usize, usize); 4] = if degree == 4 {
                [
                    (x, y),
                    (w - 1 - if rotate { y } else { x }, if rotate { x } else { y }),
                    (if rotate { w - 1 - x } else { x }, h - 1 - y),
                    (if rotate { y } else { w - 1 - x }, h - 1 - if rotate { x } else { y }),
                ]
            } else {
                [(x, y), (if rotate { w - 1 - x } else { x }, h - 1 - y), (x, y), (x, y)]
            };
            for &(ix, iy) in &images[1..degree] {
                st.black[iy * w + ix] = src;
            }
        }
    }
    // Rot4 never visits the centre square of an odd grid; roll for it.
    if degree == 4 && rotate && wodd == 1 && rng.below(100) <= black_pct as usize {
        st.black[(h / 2 + hodd - 1) * w + (w / 2 + wodd - 1)] = true;
    }
    st
}

/// Port of `check_dark`: would removing the bulb at `i` leave a cell dark?
fn check_dark(st: &State, i: usize) -> bool {
    st.los(i, true).cells().any(|c| st.lit[c] == 1)
}

/// Port of `place_lights`: fill every white cell with a bulb, then walk
/// the cells in random order turning each into a hub by removing every
/// bulb it can see. Returns false if bulbs still see each other.
fn place_lights(st: &mut State, rng: &mut Rng) -> bool {
    let n = st.size();
    let mut order: Vec<usize> = (0..n).collect();
    rng.shuffle(&mut order);
    let mut hub = vec![false; n];

    for x in 0..st.w {
        for y in 0..st.h {
            let i = y * st.w + x;
            if !st.black[i] {
                st.set_light(i, true);
            }
        }
    }

    for i in order {
        if !st.light[i] || hub[i] {
            continue;
        }
        let seen: Vec<usize> = st.los(i, false).cells().filter(|&c| st.light[c]).collect();
        if seen.is_empty() {
            continue;
        }
        if !seen.iter().any(|&c| check_dark(st, c)) {
            for c in seen {
                st.set_light(c, false);
            }
            hub[i] = true;
        }
        if !st.grid_overlap() {
            return true;
        }
    }
    !st.grid_overlap()
}

/// Port of `place_numbers`: every black cell gets its true bulb count.
fn place_numbers(st: &mut State) {
    for i in 0..st.size() {
        if st.black[i] {
            st.clue[i] = Some(st.lit_neighbours(i));
        }
    }
}

/// Port of `puzzle_is_good`: the technique solver at this tier must reach
/// a full solution with no guessing. Because every technique is sound,
/// reaching one also proves uniqueness.
fn puzzle_is_good(st: &mut State, tier: Tier) -> bool {
    st.unplace_lights();
    solve(st, tier, None) == Outcome::Solved
}

/// Port of `strip_unused_nums`: drop clues no basic deduction touched.
fn strip_unused_nums(st: &mut State) {
    for i in 0..st.size() {
        if st.clue[i].is_some() && !st.clue_used[i] {
            st.clue[i] = None;
        }
    }
}

/// Port of `new_game_desc`.
pub(crate) fn generate(seed: u64, params: Params) -> Generated {
    let (w, h) = (params.width as usize, params.height as usize);
    assert!(w >= 2 && h >= 2, "width and height must be at least 2");
    assert!((5..=100).contains(&params.black_pct), "black_pct must be between 5 and 100");
    let symmetry = match params.symmetry {
        Symmetry::Rot4 if w != h => Symmetry::Rot2,
        s => s,
    };
    let tier = params.tier;
    let mut black_pct = params.black_pct;
    let mut rng = Rng::new(seed);

    let mut order: Vec<usize> = (0..w * h).collect();
    rng.shuffle(&mut order);

    loop {
        for _ in 0..MAX_GRIDGEN_TRIES {
            let mut st = set_blacks(w, h, symmetry, black_pct, &mut rng);
            if !place_lights(&mut st, &mut rng) {
                continue;
            }
            let solution: Vec<u8> = st.light.iter().map(|&b| b as u8).collect();
            place_numbers(&mut st);
            if !puzzle_is_good(&mut st, tier) {
                continue;
            }

            let mut stripped = st.clone();
            strip_unused_nums(&mut stripped);
            if puzzle_is_good(&mut stripped, tier) {
                st = stripped;
            }

            for &i in &order {
                let Some(clue) = st.clue[i] else {
                    continue;
                };
                st.clue[i] = None;
                if !puzzle_is_good(&mut st, tier) {
                    st.clue[i] = Some(clue);
                }
            }

            if tier == Tier::Tricky && puzzle_is_good(&mut st, Tier::Easy) {
                continue;
            }

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
        if black_pct < 90 {
            black_pct += 5;
        }
    }
}
