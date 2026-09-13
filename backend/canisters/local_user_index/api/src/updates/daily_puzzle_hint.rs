use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DailyPuzzleUserState, GameId, PuzzleNumber, ServedHint};

#[ts_export(local_user_index, daily_puzzle_hint)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    /// 1 = highlight, 2 = explain, 3 = fill
    pub level: u8,
    /// The user's current (key, value) entries, used for the mistake check and to pick the step
    pub filled: Vec<(u16, u8)>,
    pub expected_price: u32,
}

#[ts_export(local_user_index, daily_puzzle_hint)]
#[derive(Serialize, Deserialize, Debug)]
#[expect(clippy::large_enum_variant)]
pub enum Response {
    Success(HintResult),
    Error(OCError),
}

#[ts_export(local_user_index, daily_puzzle_hint)]
#[derive(Serialize, Deserialize, Debug)]
pub struct HintResult {
    pub hint: ServedHint,
    /// Hint steps used so far (a mistake hint does not count)
    pub hints_used: u8,
    pub state: DailyPuzzleUserState,
    /// The user's CHIT balance after the hint price, as reported by the user canister. None when
    /// nothing was debited in this call (free level, mistake hint, already served, or key reused).
    #[serde(default)]
    pub chit_balance: Option<i32>,
    #[serde(default)]
    pub total_chit_earned: Option<i32>,
}
