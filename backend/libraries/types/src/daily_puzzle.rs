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
    /// Waive the entry fee for a user who has never started any daily puzzle. Gated on starting
    /// rather than solving: a player who never solves would otherwise play free forever.
    pub first_play_free: bool,
    /// CHIT credited on solve, indexed by the number of consecutive days solved BEFORE this one,
    /// clamped to the last entry. So [250, 300, 350, 400, 450, 500, 500] pays 250 on a fresh streak.
    pub reward_by_streak: Vec<u32>,
    /// CHIT deducted from the reward per hint step served, floored at zero. Every step counts:
    /// a hint is a hint, whichever level it was bought at.
    pub hint_penalty: u32,
    /// A solve faster than this is still recorded, paid and counted for the streak, but the local
    /// user index does not push it to the results index, so it can back no card and move no
    /// published aggregate. The client is told the floor so it can decline to offer the card too.
    pub min_carded_solve_ms: u64,
    /// Submissions per user per puzzle before the local user index refuses further ones.
    pub max_submits: u16,
    /// Hint calls per user per puzzle that name a key in `filled` and come back without a paid
    /// hint. The free mistake check answers "is this key right?" for a client-chosen key, so
    /// without a bound it is an unmetered oracle: one call per key reads the whole solution
    /// without spending any CHIT. Counted on every such call before it branches on what the
    /// solution says, and given back only when a paid hint is served, since a refusal that costs
    /// nothing where the others cost a check still tells the caller which one it was. A call with
    /// nothing in `filled` names no key and is not counted.
    pub max_free_checks: u16,
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
            max_free_checks: 20,
        }
    }
}

/// Per-game tuning. Travels with the puzzle.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GameConfig {
    /// CHIT per hint level, index 0 = level 1 (highlight), 1 = level 2 (explain), 2 = level 3 (fill).
    /// Every level costs something: a free tier makes the whole ladder skippable and leaves the
    /// paid tiers unreachable, because a free level 1 on each of `max_hints` steps exhausts the
    /// same budget the paid ones draw on. Upgrading a step already served costs the difference
    /// between the two levels, so working up the ladder is never dearer than jumping to the top,
    /// which is also why the prices must strictly increase: a flat or descending entry prices an
    /// upgrade to the answer at nothing.
    pub hint_prices: Vec<u32>,
    /// Maximum hint steps per user per puzzle.
    pub max_hints: u8,
}

impl Default for GameConfig {
    fn default() -> Self {
        GameConfig {
            hint_prices: vec![25, 75, 200],
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
            max_free_checks: self.config.max_free_checks,
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
    /// Paired with `DailyPuzzleUserState::free_checks`, so the client can stop offering the check
    /// rather than let the call come back throttled
    pub max_free_checks: u16,
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
    /// 1 = focus only, `technique` withheld as 0; 2 = focus + technique + target; 3 = all of it
    /// plus the conclusions, which are the answer. A `target` naming a key the step concludes is
    /// withheld below level 3, so an empty `target` at level 2 means "paint the whole of `focus`".
    pub level: u8,
    /// True when this is a "you have a mistake" hint: `focus` is the single lowest key whose value
    /// disagrees with the solution, and there are no conclusions. One key, never the set: `filled`
    /// is client-supplied and can cover the board, so returning every disagreement would answer
    /// the puzzle in one call.
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
    /// Hint calls that came back without a paid hint, bounded by `max_free_checks`.
    pub free_checks: u16,
    /// Consecutive days with a solve, ending yesterday (or today if solved). Series-level, the same
    /// value on every state of the same day. What the card shows.
    pub streak: u32,
    /// Whether this user has ever solved any daily puzzle.
    pub has_solved_before: bool,
    /// What this user would pay to start this puzzle, which is what `daily_puzzle_start` expects
    /// in `expected_entry_fee`. Zero once started, since the fee is then already settled. The
    /// free first play depends on history the client cannot see, so this is the only way to get
    /// the figure right.
    pub entry_fee: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DailyPuzzleSolved {
    pub solved_at: TimestampMillis,
    pub solve_time_ms: u64,
    /// Zero once the user canister has refused the credit outright, so this never claims CHIT
    /// that was not paid.
    pub reward: u32,
    pub hints_used: u8,
    pub streak: u32,
    /// The user's CHIT balance after the reward was credited, as reported by the user canister.
    /// Only set on the submit response, and only when the credit was applied in the same call;
    /// None when it was queued for retry or refused. Stored copies are always None.
    #[serde(default)]
    pub chit_balance: Option<i32>,
    #[serde(default)]
    pub total_chit_earned: Option<i32>,
}
