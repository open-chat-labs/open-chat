use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{PinNumberWrapper, UnitResult};

// Checks the user's PIN on its own, ahead of each payment they approve from their wallet
#[ts_export(user, check_pin_number)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub pin: PinNumberWrapper,
}

pub type Response = UnitResult;
