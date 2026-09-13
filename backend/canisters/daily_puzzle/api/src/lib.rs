use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{GameId, LIGHT_UP_GAME_ID};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

/// Generator parameters for one weekday.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct PuzzleParams {
    /// Defaults to light_up for schedules stored before games were part of the schedule.
    #[serde(default = "default_game_id")]
    pub game_id: GameId,
    pub width: u8,
    pub height: u8,
    /// 0 = easy, 1 = tricky
    pub tier: u8,
    pub black_pct: u8,
}

/// A candidate as shown to governance: layout only, no solution or hints.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CandidateView {
    pub game_id: GameId,
    pub index: u8,
    #[serde(with = "serde_bytes")]
    pub description: Vec<u8>,
    pub tier: u8,
    pub vetoed: bool,
    pub hint_count: u32,
}

fn default_game_id() -> GameId {
    LIGHT_UP_GAME_ID.to_string()
}
