use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

/// Identifies a game type, e.g. "light_up". Opaque to every canister; only the generator
/// (daily_puzzle canister) and the client renderer interpret the bytes of a puzzle.
pub type GameId = String;

/// Puzzle number = UTC day number (days since the Unix epoch). Puzzle N is live from
/// N * DAY_IN_MS until (N + 1) * DAY_IN_MS.
pub type PuzzleNumber = u32;

pub const LIGHT_UP_GAME_ID: &str = "light_up";

/// One step of the generator's deduction trace. Served to the client in order as hints.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct PuzzleHint {
    /// Game-specific technique id; the client maps it to a sentence.
    pub technique: u8,
    /// Every key the deduction looked at (game-specific keys, for grids y * width + x). A
    /// superset of `target`; the board paints these faintly as context.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at with "this cell", "this number", "these
    /// cells": what the board paints strongly. Empty means the whole of `focus` (legacy).
    #[serde(default)]
    pub target: Vec<u16>,
    /// (key, value) pairs the deduction concludes. For Light Up value 1 = bulb, 0 = no bulb.
    pub conclusions: Vec<(u16, u8)>,
}

/// Series-level tuning, the same for every game. Lives in the daily_puzzle canister and travels
/// with the push. Per-game tuning is `GameConfig`.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DailyPuzzleConfig {
    /// The launch / kill switch. When false every game call answers NotAvailable.
    pub enabled: bool,
    /// CHIT debited on start.
    pub entry_fee: u32,
    /// Waive the entry fee for a user who has never solved any daily puzzle.
    pub first_play_free: bool,
    /// CHIT credited on solve, indexed by the number of consecutive days solved BEFORE this one,
    /// clamped to the last entry. So [250, 300, 350, 400, 450, 500, 500] pays 250 on a fresh streak.
    pub reward_by_streak: Vec<u32>,
    /// CHIT deducted from the reward per hint served (levels 2 and 3 only), floored at zero.
    pub hint_penalty: u32,
    /// Solves faster than this are recorded but the client does not offer a card.
    pub min_carded_solve_ms: u64,
    /// Submissions per user per puzzle before the local user index refuses further ones.
    pub max_submits: u16,
}

impl Default for DailyPuzzleConfig {
    fn default() -> Self {
        DailyPuzzleConfig {
            enabled: false,
            entry_fee: 100,
            first_play_free: true,
            reward_by_streak: vec![250, 300, 350, 400, 450, 500, 500],
            hint_penalty: 50,
            min_carded_solve_ms: 10_000,
            max_submits: 20,
        }
    }
}

/// Per-game tuning. Travels with the puzzle.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GameConfig {
    /// CHIT per hint level, index 0 = level 1 (highlight), 1 = level 2 (explain), 2 = level 3 (fill).
    pub hint_prices: Vec<u32>,
    /// Maximum hint steps per user per puzzle.
    pub max_hints: u8,
}

impl Default for GameConfig {
    fn default() -> Self {
        GameConfig {
            hint_prices: vec![0, 100, 200],
            max_hints: 3,
        }
    }
}

/// One puzzle as pushed from the daily_puzzle canister to every local user index. The daily
/// canister holds one per game per day; with the weekday rotation that is one puzzle a day, but
/// every consumer treats the current set as a map keyed by `game_id`.
/// Contains the solution: never returned from any public query.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DailyPuzzle {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    pub tier: u8,
    pub description: Vec<u8>,
    pub solution: Vec<u8>,
    /// The solution in hint-key space: the (key, value) the generator's hints and the client's
    /// grid use for this game (cell, edge, ...), one entry per decidable key, sorted by key. Used
    /// for mistake checks. Empty means "index `solution` bytes by key" (legacy, wrong for games
    /// whose key space differs from the solution byte layout).
    #[serde(default)]
    pub solution_pairs: Vec<(u16, u8)>,
    pub hints: Vec<PuzzleHint>,
    pub starts_at: TimestampMillis,
    pub expires_at: TimestampMillis,
    /// Series config, identical on every puzzle of the same day.
    pub config: DailyPuzzleConfig,
    #[serde(default)]
    pub game_config: GameConfig,
}

impl DailyPuzzle {
    pub fn public(&self) -> PublicDailyPuzzle {
        PublicDailyPuzzle {
            game_id: self.game_id.clone(),
            number: self.number,
            tier: self.tier,
            description: self.description.clone(),
            starts_at: self.starts_at,
            expires_at: self.expires_at,
            enabled: self.config.enabled,
            entry_fee: self.config.entry_fee,
            first_play_free: self.config.first_play_free,
            hint_prices: self.game_config.hint_prices.clone(),
            max_hints: self.game_config.max_hints,
            min_carded_solve_ms: self.config.min_carded_solve_ms,
        }
    }
}

/// What the client sees. No solution, no hints.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PublicDailyPuzzle {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    pub tier: u8,
    #[serde(with = "serde_bytes")]
    pub description: Vec<u8>,
    pub starts_at: TimestampMillis,
    pub expires_at: TimestampMillis,
    pub enabled: bool,
    pub entry_fee: u32,
    pub first_play_free: bool,
    pub hint_prices: Vec<u32>,
    pub max_hints: u8,
    pub min_carded_solve_ms: u64,
}

/// One row of the results index, pushed local user index -> daily_puzzle canister on each solve,
/// and returned by the verification query that result cards are checked against.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DailyPuzzleResult {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    pub user_id: UserId,
    pub solve_time_ms: u64,
    pub hints_used: u8,
    /// Consecutive puzzles solved including this one.
    pub streak: u32,
    pub solved_at: TimestampMillis,
}

/// A hint as served to one user: the generator's step plus the level it was revealed to.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ServedHint {
    pub hint: PuzzleHint,
    /// 1 = focus only, 2 = focus + technique, 3 = focus + technique + conclusions applied.
    pub level: u8,
    /// True when this is a "you have a mistake" hint: focus = the wrong cells, no conclusions.
    pub mistake: bool,
}

/// Per-user state for one current puzzle as returned to the client by the local user index.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DailyPuzzleUserState {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    pub started_at: Option<TimestampMillis>,
    pub hints: Vec<ServedHint>,
    #[serde(with = "serde_bytes")]
    pub grid: Vec<u8>,
    pub grid_saved_at: Option<TimestampMillis>,
    pub solved: Option<DailyPuzzleSolved>,
    pub submits: u16,
    /// Consecutive days with a solve, ending yesterday (or today if solved). Series-level, the same
    /// value on every state of the same day. What the card shows.
    pub streak: u32,
    /// Whether this user has ever solved any daily puzzle (drives first_play_free).
    pub has_solved_before: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DailyPuzzleSolved {
    pub solved_at: TimestampMillis,
    pub solve_time_ms: u64,
    pub reward: u32,
    pub hints_used: u8,
    pub streak: u32,
    /// The user's CHIT balance after the reward was credited, as reported by the user canister.
    /// Only set on the submit response, and only when the credit was applied in the same call;
    /// None when it was queued for retry. Stored copies are always None.
    #[serde(default)]
    pub chit_balance: Option<i32>,
    #[serde(default)]
    pub total_chit_earned: Option<i32>,
}
