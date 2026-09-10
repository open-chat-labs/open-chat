use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DailyPuzzleUserState, GameId, PuzzleNumber, TimestampMillis};

#[ts_export(local_user_index, daily_puzzle_start)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    pub expected_entry_fee: u32,
}

#[ts_export(local_user_index, daily_puzzle_start)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(StartResult),
    Error(OCError),
}

#[ts_export(local_user_index, daily_puzzle_start)]
#[derive(Serialize, Deserialize, Debug)]
pub struct StartResult {
    pub started_at: TimestampMillis,
    pub state: DailyPuzzleUserState,
    /// The user's CHIT balance after the entry fee, as reported by the user canister. None when
    /// no fee was debited in this call (free start, already started, or the key was already used).
    #[serde(default)]
    pub chit_balance: Option<i32>,
    #[serde(default)]
    pub total_chit_earned: Option<i32>,
}
