use loopy::{
    Generated, Params, Technique, Tier, Violation, check_rules, count_solutions, generate, parse_description, render_ascii,
    solution_pairs, solve_with_trace,
};
use std::collections::BTreeMap;

const SEEDS_PER_CONFIG: u64 = 200;

fn params(width: u8, height: u8, tier: Tier) -> Params {
    Params::default_for(width, height, tier)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn edge_count(g: &Generated) -> usize {
    parse_description(&g.description).unwrap().edge_count()
}

/// Replays every conclusion onto an empty grid and checks that no edge is
/// set twice in conflicting ways, and that every edge ends up decided.
fn replay_hints(g: &Generated) -> Vec<u8> {
    let n = edge_count(g);
    let mut grid = vec![0u8; n];
    let mut no_line = vec![false; n];
    for hint in &g.hints {
        for &(edge, value) in &hint.conclusions {
            let edge = edge as usize;
            if value == 1 {
                assert!(!no_line[edge], "hint draws an edge already ruled out");
                grid[edge] = 1;
            } else {
                assert_eq!(grid[edge], 0, "hint rules out an edge already drawn");
                no_line[edge] = true;
            }
        }
    }
    for e in 0..n {
        assert!(grid[e] == 1 || no_line[e], "edge {e} never decided by any hint");
    }
    grid
}

/// `pairs` is the solution over every edge, and every hint conclusion
/// agrees with it.
fn check_pairs(g: &Generated, ctx: &str) {
    assert_eq!(g.pairs, solution_pairs(&g.description, &g.solution), "{ctx}: pairs");
    let keys: Vec<u16> = g.pairs.iter().map(|&(k, _)| k).collect();
    let edges: Vec<u16> = (0..edge_count(g) as u16).collect();
    assert_eq!(keys, edges, "{ctx}: pairs keys are not every edge");
    let pairs: BTreeMap<u16, u8> = g.pairs.iter().copied().collect();
    let mut replayed = BTreeMap::new();
    for hint in &g.hints {
        for &(k, v) in &hint.conclusions {
            replayed.insert(k, v);
        }
    }
    assert_eq!(replayed, pairs, "{ctx}: replayed hints differ from pairs");
}

fn check_generated(seed: u64, p: Params) {
    let g = generate(seed, p);
    let ctx = format!("seed {seed} {}x{} {:?}", p.width, p.height, p.tier);

    assert_eq!(g.tier, p.tier, "{ctx}");
    assert_eq!(count_solutions(&g.description, 2), 1, "{ctx}: not unique");
    assert!(
        check_rules(&g.description, &g.solution).is_empty(),
        "{ctx}: solution breaks rules"
    );

    let (hints, solved) = solve_with_trace(&g.description, p.tier);
    assert_eq!(
        solved.as_deref(),
        Some(g.solution.as_slice()),
        "{ctx}: solver disagrees with solution"
    );
    assert_eq!(hints, g.hints, "{ctx}: trace differs from stored hints");
    assert!(!g.hints.is_empty(), "{ctx}: no hints");

    let n = edge_count(&g);
    let cells = p.width as usize * p.height as usize;
    let dots = (p.width as usize + 1) * (p.height as usize + 1);
    for hint in &g.hints {
        assert!(!hint.focus.is_empty(), "{ctx}: empty focus");
        assert!(!hint.target.is_empty(), "{ctx}: empty target");
        assert!(!hint.conclusions.is_empty(), "{ctx}: empty conclusions");
        for &k in &hint.focus {
            assert!((k as usize) < n + cells + dots, "{ctx}: focus key {k} out of range");
        }
        for &k in &hint.target {
            assert!(hint.focus.contains(&k), "{ctx}: target key {k} is not in focus");
        }
        for &(edge, value) in &hint.conclusions {
            assert_eq!(g.solution[edge as usize], value, "{ctx}: conclusion disagrees with solution");
        }
    }
    assert_eq!(
        replay_hints(&g),
        g.solution,
        "{ctx}: replaying hints does not reach the solution"
    );
    check_pairs(&g, &ctx);

    if p.tier == Tier::Tricky {
        assert!(
            solve_with_trace(&g.description, Tier::Easy).1.is_none(),
            "{ctx}: easy solver finished a tricky puzzle"
        );
    }
}

#[test]
fn generated_6x6_easy() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(6, 6, Tier::Easy));
    }
}

#[test]
fn generated_6x6_tricky() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(6, 6, Tier::Tricky));
    }
}

#[test]
fn generated_8x8_easy() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(8, 8, Tier::Easy));
    }
}

#[test]
fn generated_8x8_tricky() {
    for seed in 0..SEEDS_PER_CONFIG {
        check_generated(seed, params(8, 8, Tier::Tricky));
    }
}

#[test]
fn single_edge_perturbation_is_caught() {
    for seed in 0..50 {
        let p = params(6, 6, if seed % 2 == 0 { Tier::Easy } else { Tier::Tricky });
        let g = generate(seed, p);
        for e in 0..g.solution.len() {
            let mut grid = g.solution.clone();
            grid[e] ^= 1;
            assert!(
                !check_rules(&g.description, &grid).is_empty(),
                "seed {seed}: flipping edge {e} went unnoticed"
            );
        }
    }
}

#[test]
fn generation_is_deterministic() {
    for (w, h, tier) in [(6, 6, Tier::Easy), (8, 8, Tier::Tricky)] {
        let a = generate(7, params(w, h, tier));
        let b = generate(7, params(w, h, tier));
        assert_eq!(a.description, b.description);
        assert_eq!(a.solution, b.solution);
        assert_eq!(a.hints, b.hints);
    }
}

#[test]
fn fixed_seed_snapshot() {
    // Generated once from seed 42, 6x6, Easy. Any change here means the
    // wire encoding or the generator's RNG stream drifted.
    const DESCRIPTION_HEX: &str = "010606ffffffff03ff0301ff02ffffffffff02ffff030002ff03ffff010102ffff0302ffff03ff";
    const SOLUTION_HEX: &str = "000100010001010000000100010000010000010001000100010000010100010001010001010100000100000101010101010100010100000100010100010001010000010001010001000000000101000100010100";
    let g = generate(42, params(6, 6, Tier::Easy));
    assert_eq!(hex(&g.description), DESCRIPTION_HEX);
    assert_eq!(hex(&g.solution), SOLUTION_HEX);
}

#[test]
fn tricky_uses_corner_pair_techniques() {
    let tricky = [Technique::CornerPairsFull, Technique::CornerPairsShort];
    for seed in 0..20 {
        let g = generate(seed, params(6, 6, Tier::Tricky));
        assert!(
            g.hints.iter().any(|h| tricky.contains(&h.technique)),
            "seed {seed}: tricky puzzle solved without a corner-pair deduction"
        );
        let easy = generate(seed, params(6, 6, Tier::Easy));
        assert!(
            easy.hints.iter().all(|h| !tricky.contains(&h.technique)),
            "seed {seed}: easy trace contains a tricky technique"
        );
    }
}

#[test]
fn parse_rejects_bad_input() {
    let good = generate(1, params(6, 6, Tier::Easy)).description;
    assert!(parse_description(&good).is_ok());

    let mut wrong_version = good.clone();
    wrong_version[0] = 2;
    assert!(parse_description(&wrong_version).is_err());

    let mut short = good.clone();
    short.pop();
    assert!(parse_description(&short).is_err());
    let mut long = good.clone();
    long.push(0);
    assert!(parse_description(&long).is_err());
    assert!(parse_description(&[]).is_err());
    assert!(parse_description(&[1, 0, 6]).is_err());

    for bad in [0x04, 0x10, 0x7f, 0xfe] {
        let mut bytes = good.clone();
        bytes[3] = bad;
        assert!(parse_description(&bytes).is_err(), "clue byte {bad:#04x} accepted");
    }
    for ok in [0x00, 0x03, 0xff] {
        let mut bytes = good.clone();
        bytes[3] = ok;
        assert!(parse_description(&bytes).is_ok(), "clue byte {ok:#04x} rejected");
    }

    let d = parse_description(&good).unwrap();
    assert_eq!(d.clues.len(), 36);
    assert_eq!(d.edge_count(), 84);
    assert!(d.clues.iter().any(|c| c.is_some()));
    assert!(d.clues.iter().any(|c| c.is_none()));
}

#[test]
fn render_ascii_has_tathams_layout() {
    let g = generate(3, params(8, 5, Tier::Easy));
    let puzzle = render_ascii(&g.description, None);
    let solved = render_ascii(&g.description, Some(&g.solution));
    assert_eq!(puzzle.lines().count(), 11);
    assert_eq!(solved.lines().count(), 11);
    assert!(puzzle.lines().all(|l| l.chars().count() == 17));
    assert!(solved.lines().all(|l| l.chars().count() == 17));
    assert!(!puzzle.contains('-') && !puzzle.contains('|'));
    assert!(solved.contains('-') && solved.contains('|'));
    assert!(puzzle.starts_with("+ +"));
}

#[test]
fn check_rules_reports_each_violation_kind() {
    let g = generate(5, params(6, 6, Tier::Easy));
    let d = parse_description(&g.description).unwrap();
    let n = d.edge_count();

    let empty = vec![0u8; n];
    let violations = check_rules(&g.description, &empty);
    assert!(violations.iter().any(|v| matches!(v, Violation::ClueCount { actual: 0, .. })));
    assert!(
        violations.iter().all(|v| matches!(v, Violation::ClueCount { .. })),
        "an empty grid has no dot or loop errors"
    );

    // Drawing an extra edge off the loop makes a degree-3 dot and a
    // degree-1 dot, or two degree-1 dots.
    let extra = (0..n).find(|&e| g.solution[e] == 0).unwrap();
    let mut grid = g.solution.clone();
    grid[extra] = 1;
    let violations = check_rules(&g.description, &grid);
    let degrees: Vec<u8> = violations
        .iter()
        .filter_map(|v| match v {
            Violation::DotDegree { degree, .. } => Some(*degree),
            _ => None,
        })
        .collect();
    assert!(!degrees.is_empty());
    assert!(degrees.iter().all(|&d| d == 1 || d == 3), "{degrees:?}");
    assert!(!violations.iter().any(|v| matches!(v, Violation::ExtraLoop { .. })));

    // Two unit squares on an unclued 4x4: 40 edges, horizontals first
    // (5 rows of 4), then verticals (4 rows of 5).
    let mut desc = vec![1, 4, 4];
    desc.extend([0xff; 16]);
    let mut two_loops = vec![0u8; 40];
    for e in [0, 4, 20, 21, 11, 15, 33, 34] {
        two_loops[e] = 1;
    }
    let violations = check_rules(&desc, &two_loops);
    assert_eq!(violations.len(), 1, "{violations:?}");
    assert!(matches!(&violations[0], Violation::ExtraLoop { edges } if edges.len() == 4));

    // A stray edge off one square is a degree problem, not a loop problem.
    two_loops[1] = 1;
    let violations = check_rules(&desc, &two_loops);
    assert!(violations.iter().any(|v| matches!(v, Violation::DotDegree { .. })));
    assert!(!violations.iter().any(|v| matches!(v, Violation::ExtraLoop { .. })));

    let wrong_length = check_rules(&g.description, &[]);
    assert!(wrong_length.iter().all(|v| matches!(v, Violation::ClueCount { .. })));
}
