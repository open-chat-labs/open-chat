use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GameId, PuzzleNumber, UnitResult};

#[ts_export(local_user_index, daily_puzzle_save_grid)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    #[serde(with = "serde_bytes")]
    pub grid: Vec<u8>,
}

pub type Response = UnitResult;
