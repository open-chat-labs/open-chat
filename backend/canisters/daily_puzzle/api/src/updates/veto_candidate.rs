use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{GameId, PuzzleNumber, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub number: PuzzleNumber,
    pub game_id: GameId,
    pub index: u8,
}

pub type Response = UnitResult;
