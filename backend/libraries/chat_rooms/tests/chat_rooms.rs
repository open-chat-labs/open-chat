use chat_rooms::{
    ChatRooms, LOGO, MAX_SIZE, MIN_SIZE, NO_LOGO, Params, Violation, check_rules, count_solutions, generate, is_complete,
    parse_description, solve_with_trace,
};
use puzzle_core::testing::{must_generate, must_only_claim_sound_solutions, must_reject};
use puzzle_core::{Puzzle, PuzzleError, Tier};

const SEEDS_PER_CONFIG: u64 = 20;

fn params(size: u8, tier: Tier) -> Params {
    Params::default_for(size, size, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Invariants 1, 3 and 4: the shared harness checks that every puzzle
/// has one solution, generates the same bytes twice, and that the
/// solver's trace reaches the stored solution under the #9404 target
/// contract.
#[test]
fn generated_8x8() {
    for tier in Tier::ALL {
        must_generate::<ChatRooms>(params(8, tier), 0..SEEDS_PER_CONFIG);
    }
}

/// Every size and tier this game accepts produces a puzzle.
#[test]
fn every_playable_size_generates() {
    for size in MIN_SIZE as u8..=MAX_SIZE as u8 {
        for tier in Tier::ALL {
            must_generate::<ChatRooms>(params(size, tier), 0..8);
        }
    }
}

/// Sizes with no puzzle, and boards that are not square, are turned away
/// up front rather than searched for.
#[test]
fn impossible_sizes_are_rejected() {
    for tier in Tier::ALL {
        for size in [0, 3, 4, MAX_SIZE as u8 + 1, 32] {
            must_reject::<ChatRooms>(params(size, tier), 0..3);
        }
        must_reject::<ChatRooms>(Params::default_for(8, 9, tier), 0..3);
    }
}

/// Invariant 2: one logo in every row, column and room, and no two
/// touching. Checked directly rather than through `check_rules`, so a bug
/// shared by the checker and the generator cannot hide it.
#[test]
fn solution_has_one_logo_per_row_column_room_and_none_touch() {
    for seed in 0..10 {
        let tier = if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky };
        let g = generate(seed, params(8, tier)).unwrap();
        let d = parse_description(&g.description).unwrap();
        let n = d.size as usize;
        let logos: Vec<(usize, usize)> = (0..n * n)
            .filter(|&i| g.solution[i] == LOGO)
            .map(|i| (i % n, i / n))
            .collect();
        assert_eq!(logos.len(), n, "seed {seed}: {} logos", logos.len());
        for k in 0..n {
            assert_eq!(logos.iter().filter(|(_, y)| *y == k).count(), 1, "seed {seed}: row {k}");
            assert_eq!(logos.iter().filter(|(x, _)| *x == k).count(), 1, "seed {seed}: column {k}");
            let in_room = logos.iter().filter(|(x, y)| d.rooms[y * n + x] as usize == k).count();
            assert_eq!(in_room, 1, "seed {seed}: room {k}");
        }
        for (a, &(ax, ay)) in logos.iter().enumerate() {
            for &(bx, by) in &logos[a + 1..] {
                assert!(ax.abs_diff(bx) > 1 || ay.abs_diff(by) > 1, "seed {seed}: logos touch");
            }
        }
        assert!(g.solution.iter().all(|&v| v == LOGO || v == NO_LOGO));
    }
}

/// Invariant 5: a Tricky puzzle needs a Tricky technique.
#[test]
fn tricky_puzzles_defeat_the_easy_solver() {
    for seed in 0..20 {
        let g = generate(seed, params(8, Tier::Tricky)).unwrap();
        assert!(
            solve_with_trace(&g.description, Tier::Easy).unwrap().1.is_none(),
            "seed {seed}: easy solver finished a tricky puzzle"
        );
    }
}

/// Invariant 6: every room is one piece, joined across and down.
#[test]
fn every_room_is_connected() {
    for seed in 0..10 {
        for size in [6, 8, 9] {
            let g = generate(seed, params(size, Tier::Easy)).unwrap();
            let d = parse_description(&g.description).unwrap();
            let n = d.size as usize;
            for room in 0..n as u8 {
                let cells: Vec<usize> = (0..n * n).filter(|&i| d.rooms[i] == room).collect();
                let mut seen = vec![cells[0]];
                let mut stack = vec![cells[0]];
                while let Some(i) = stack.pop() {
                    for j in puzzle_core::neighbours(n, n, i) {
                        if d.rooms[j] == room && !seen.contains(&j) {
                            seen.push(j);
                            stack.push(j);
                        }
                    }
                }
                assert_eq!(seen.len(), cells.len(), "seed {seed} {size}x{size}: room {room} is split");
            }
        }
    }
}

/// Invariant 17: at most one room is a single cell. Each one gives its
/// logo away, so more than one makes the start trivial.
#[test]
fn at_most_one_single_cell_room() {
    for size in MIN_SIZE as u8..=MAX_SIZE as u8 {
        let tier = if size % 2 == 0 { Tier::Easy } else { Tier::Tricky };
        let g = generate(0, params(size, tier)).unwrap();
        let d = parse_description(&g.description).unwrap();
        let mut sizes = vec![0; size as usize];
        for &r in &d.rooms {
            sizes[r as usize] += 1;
        }
        let single = sizes.iter().filter(|&&s| s == 1).count();
        // The invariant's own bound, not the constant: raising the constant must fail here
        assert!(single <= 1, "{size}x{size} {tier:?}: {single} one-cell rooms");
    }
}

/// Invariant 13: room ids are numbered in the order they are first met
/// reading the grid, so an id carries nothing about where its logo is.
#[test]
fn room_ids_follow_reading_order() {
    for seed in 0..10 {
        let g = generate(seed, params(8, Tier::Easy)).unwrap();
        let d = parse_description(&g.description).unwrap();
        let mut next = 0;
        for &room in &d.rooms {
            assert!(room <= next, "seed {seed}: room {room} appears before room {next}");
            if room == next {
                next += 1;
            }
        }
    }
}

/// Invariant 23: a step lists every cell it relies on. Each cell a step points at (its target)
/// lies in a row, column or room whose every cell is in the step's focus, so the cells the step
/// relies on having been ruled out are listed with it. The LocalUserIndex serves the steps a hint
/// rests on by following its focus (#9588), so a ruled-out cell left out of the focus is a
/// premise the player can be missing while the hint reads as proven: "these are the only cells
/// left for this room" with another of the room's cells still open on the player's board.
#[test]
fn every_step_lists_the_cells_it_relies_on() {
    for size in [6u8, 8, 9] {
        for tier in Tier::ALL {
            for seed in 0..5 {
                let g = generate(seed, params(size, tier)).unwrap();
                let d = parse_description(&g.description).unwrap();
                let n = size as usize;
                let groups: Vec<Vec<u16>> = (0..n)
                    .map(|r| (0..n).map(|c| (r * n + c) as u16).collect())
                    .chain((0..n).map(|c| (0..n).map(|r| (r * n + c) as u16).collect()))
                    .chain((0..n as u8).map(|room| (0..n * n).filter(|&i| d.rooms[i] == room).map(|i| i as u16).collect()))
                    .collect();
                for (s, hint) in g.hints.iter().enumerate() {
                    if hint.technique == chat_rooms::Technique::Shadow {
                        // A shadow rests on its logo alone, which is its target
                        continue;
                    }
                    for &t in &hint.target {
                        assert!(
                            groups
                                .iter()
                                .any(|grp| grp.contains(&t) && grp.iter().all(|k| hint.focus.contains(k))),
                            "{size}x{size} {tier:?} seed {seed} step {s} ({:?}): target cell {t} is in no row, column or room listed whole in the focus {:?}",
                            hint.technique,
                            hint.focus
                        );
                    }
                }
            }
        }
    }
}

/// Invariant 7: each rule, broken alone, is reported, and an unfinished
/// grid with nothing wrong is not.
#[test]
fn each_rule_break_is_reported() {
    // 5x5, rooms are the columns except that cell 12 (the centre) is room 0's
    let mut d = vec![1, 5, 5];
    for i in 0..25u8 {
        d.push(if i == 12 { 0 } else { i % 5 });
    }
    let grid = |logos: &[usize]| {
        let mut g = vec![NO_LOGO; 25];
        for &i in logos {
            g[i] = LOGO;
        }
        g
    };

    assert!(check_rules(&d, &grid(&[])).unwrap().is_empty());
    assert!(check_rules(&d, &grid(&[0, 7])).unwrap().is_empty());

    assert_eq!(
        check_rules(&d, &grid(&[0, 3])).unwrap(),
        vec![Violation::Row {
            row: 0,
            cells: vec![0, 3]
        }]
    );
    // 12 sits in column 2 but not room 2, so this breaks the column and nothing else
    assert_eq!(
        check_rules(&d, &grid(&[2, 12])).unwrap(),
        vec![Violation::Column {
            column: 2,
            cells: vec![2, 12]
        }]
    );
    // 12 sits in column 2 but room 0, so this breaks the room and nothing else
    assert_eq!(
        check_rules(&d, &grid(&[5, 12])).unwrap(),
        vec![Violation::Room {
            room: 0,
            cells: vec![5, 12]
        }]
    );
    // Diagonal neighbours in different rows, columns and rooms
    assert_eq!(
        check_rules(&d, &grid(&[6, 12])).unwrap(),
        vec![Violation::Touching { a: 6, b: 12 }]
    );
}

#[test]
fn partial_solution_is_incomplete_not_wrong() {
    let g = generate(9, params(8, Tier::Tricky)).unwrap();
    let mut grid = g.solution.clone();
    let first = grid.iter().position(|&v| v == LOGO).unwrap();
    grid[first] = NO_LOGO;
    assert!(check_rules(&g.description, &grid).unwrap().is_empty());
    assert!(!is_complete(&g.description, &grid).unwrap());
    assert!(!ChatRooms::is_solved(&g.description, &grid).unwrap());
}

#[test]
fn single_cell_change_is_caught() {
    for seed in 0..2 {
        let g = generate(seed, params(8, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky })).unwrap();
        for i in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[i] = if grid[i] == LOGO { NO_LOGO } else { LOGO };
            assert!(
                !ChatRooms::is_solved(&g.description, &grid).unwrap(),
                "seed {seed}: changing cell {i} still counts as solved"
            );
        }
    }
}

/// Invariant 8: malformed descriptions are refused, never panicked on.
#[test]
fn malformed_descriptions_are_rejected() {
    let good = generate(1, params(6, Tier::Easy)).unwrap().description;
    assert!(parse_description(&good).is_ok());

    let mut wrong_version = good.clone();
    wrong_version[0] = 2;
    let mut short = good.clone();
    short.pop();
    let mut long = good.clone();
    long.push(0);
    let mut room_too_big = good.clone();
    room_too_big[3] = 6;
    // Every cell in room 0, so rooms 1..6 have no cells
    let mut rooms_missing = vec![1, 6, 6];
    rooms_missing.extend(std::iter::repeat_n(0, 36));
    // 36 room bytes: the length a 6x6 needs, so only the square check can refuse it
    let mut not_square = vec![1, 6, 7];
    not_square.extend((0..36).map(|i| (i % 6) as u8));
    let mut too_small = vec![1, 4, 4];
    too_small.extend((0..16).map(|i| (i % 4) as u8));
    let mut too_big = vec![1, 10, 10];
    too_big.extend((0..100).map(|i| (i % 10) as u8));

    for (name, bad) in [
        ("empty", vec![]),
        ("wrong version", wrong_version),
        ("short", short),
        ("long", long),
        ("room id too big", room_too_big),
        ("rooms missing", rooms_missing),
        ("not square", not_square),
        ("too small", too_small),
        ("too big", too_big),
    ] {
        assert!(
            matches!(parse_description(&bad), Err(PuzzleError::Description(_))),
            "{name} accepted"
        );
    }
}

#[test]
fn wrong_length_and_unknown_grid_bytes_are_rejected() {
    let g = generate(9, params(8, Tier::Easy)).unwrap();
    let expected = g.solution.len();
    for grid in [vec![], vec![0u8; expected - 1], vec![0u8; expected + 1]] {
        let actual = grid.len();
        assert_eq!(
            check_rules(&g.description, &grid),
            Err(PuzzleError::GridLength { expected, actual })
        );
    }
    for byte in [2u8, 0x80, 0xff] {
        let mut grid = g.solution.clone();
        grid[5] = byte;
        assert_eq!(
            check_rules(&g.description, &grid),
            Err(PuzzleError::GridValue { cell: 5, byte })
        );
    }
}

#[test]
fn count_solutions_finds_ambiguity() {
    // Every row its own room: the rooms add nothing to the rows, so a 6x6
    // has many solutions
    let mut d = vec![1, 6, 6];
    d.extend((0..36).map(|i| (i / 6) as u8));
    assert_eq!(count_solutions(&d, 2).unwrap(), 2);
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42. Any change here means the wire encoding
    // or the generator's RNG stream drifted.
    const EASY_DESCRIPTION_HEX: &str = "01080800000000000001010200030300000101020203010100010402020303010101050606030303030105060603030303050506060606030707050606060303070707";
    const EASY_SOLUTION_HEX: &str = "00000001000000000100000000000000000000000000000100000000010000000000010000000000000000000000010000010000000000000000000000010000";
    let g = generate(42, params(8, Tier::Easy)).unwrap();
    assert_eq!(hex(&g.description), EASY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), EASY_SOLUTION_HEX);

    const TRICKY_DESCRIPTION_HEX: &str = "010909000000000001010202000300030303010102000300000303010102000303030303010405000003030401010406000707030404040406070707030303040406070707080806040606070707070806060606";
    const TRICKY_SOLUTION_HEX: &str = "000000000000000100010000000000000000000000000000010000000000000000000001000001000000000000000000000100000000000100000000000000000000010000000000000000000001000000";
    let g = generate(42, params(9, Tier::Tricky)).unwrap();
    assert_eq!(hex(&g.description), TRICKY_DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), TRICKY_SOLUTION_HEX);
}

/// Room layouts the generator would never emit: random ids, rooms split
/// into pieces, most with no solution at all. What is worth pushing on is
/// whether `Solved` can come back on a board its own rule check calls
/// broken.
fn unsatisfiable_descriptions() -> Vec<Vec<u8>> {
    let mut rng = puzzle_core::Rng::new(20260929);
    let mut out = Vec::new();
    for n in [5usize, 6, 8] {
        for _ in 0..200 {
            let mut rooms: Vec<u8> = (0..n * n).map(|_| rng.below(n) as u8).collect();
            // Make sure every id appears so the description parses
            let mut cells: Vec<usize> = (0..n * n).collect();
            rng.shuffle(&mut cells);
            for (room, &cell) in cells.iter().take(n).enumerate() {
                rooms[cell] = room as u8;
            }
            let mut d = vec![1, n as u8, n as u8];
            d.extend(rooms);
            out.push(d);
        }
        // And generated puzzles with one cell moved to another room
        for seed in 0..1 {
            let Ok(g) = generate(seed, params(n as u8, Tier::Easy)) else {
                continue;
            };
            let mut d = g.description.clone();
            let i = 3 + rng.below(n * n);
            d[i] = ((d[i] as usize + 1 + rng.below(n - 1)) % n) as u8;
            if parse_description(&d).is_ok() {
                out.push(d);
            }
        }
    }
    out
}

#[test]
fn the_solver_never_claims_an_unsound_grid() {
    let claimed = must_only_claim_sound_solutions::<ChatRooms>(unsatisfiable_descriptions());
    assert!(claimed > 20, "only {claimed} of the corpus reached the solver");
}

/// Writes the hint steps of a spread of generated puzzles to the client's fixture, which
/// `chatRooms.spec.ts` reads to check every step gets a sentence naming the right row, column or
/// room (invariant 24). Run by hand when the solver's steps change:
/// `cargo test -p chat_rooms --test chat_rooms write_hint_fixture -- --ignored`
fn hint_fixture() -> (std::path::PathBuf, String) {
    let mut entries = Vec::new();
    for (size, tier, seeds) in [(6u8, Tier::Easy, 0..3u64), (8, Tier::Tricky, 0..3), (9, Tier::Tricky, 0..6)] {
        for seed in seeds {
            let g = generate(seed, params(size, tier)).unwrap();
            let steps: Vec<String> = g
                .hints
                .iter()
                .map(|h| {
                    format!(
                        "{{\"technique\":{},\"focus\":{:?},\"target\":{:?},\"conclusions\":{:?}}}",
                        u8::from(h.technique),
                        h.focus,
                        h.target,
                        h.conclusions.iter().map(|&(k, v)| [k as u32, v as u32]).collect::<Vec<_>>()
                    )
                })
                .collect();
            entries.push(format!(
                "{{\"description\":\"{}\",\"steps\":[{}]}}",
                hex(&g.description),
                steps.join(",")
            ));
        }
    }
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../frontend/openchat-shared/src/utils/dailyGames/chatRoomsHints.json");
    (path, format!("[{}]\n", entries.join(",")))
}

#[test]
#[ignore]
fn write_hint_fixture() {
    let (path, json) = hint_fixture();
    std::fs::write(path, json).unwrap();
}

/// #9675: invariant 24's client test reads a fixture of this solver's steps, so it proves nothing
/// once the solver moves on. The committed fixture must be exactly what the solver emits now.
/// Compared without whitespace, because prettier reflows the committed file.
#[test]
fn hint_fixture_is_current() {
    let (path, json) = hint_fixture();
    let strip = |s: &str| s.chars().filter(|c| !c.is_whitespace()).collect::<String>();
    let committed = std::fs::read_to_string(&path).unwrap_or_default();
    assert_eq!(
        strip(&committed),
        strip(&json),
        "{} is stale: run `cargo test -p chat_rooms --test chat_rooms write_hint_fixture -- --ignored`",
        path.display()
    );
}
