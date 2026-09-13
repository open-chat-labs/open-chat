use types::PuzzleNumber;

/// Per-puzzle seed: splitmix64(master ^ number ^ hash(game_id)).
pub fn puzzle_seed(master_seed: u64, number: PuzzleNumber, game_id: &str) -> u64 {
    splitmix64(master_seed ^ (number as u64) ^ game_hash(game_id))
}

/// Candidate `index` of a puzzle number. Index 0 of attempt 0 is the plain puzzle seed; a
/// non-zero `attempt` (a regeneration) moves the whole pool to fresh seeds.
pub fn candidate_seed(master_seed: u64, number: PuzzleNumber, game_id: &str, index: u64, attempt: u32) -> u64 {
    let mut base = puzzle_seed(master_seed, number, game_id);
    if attempt != 0 {
        base = splitmix64(base ^ attempt as u64);
    }
    if index == 0 { base } else { splitmix64(base ^ (index << 32)) }
}

pub fn splitmix64(mut z: u64) -> u64 {
    z = z.wrapping_add(0x9E3779B97F4A7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

/// FNV-1a over the game id bytes.
fn game_hash(game_id: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in game_id.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
