use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{PinNumberWrapper, UnitResult};

#[ts_export(user, pay_for_streak_insurance)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub additional_days: u8,
    pub expected_price: u128,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = UnitResult;
