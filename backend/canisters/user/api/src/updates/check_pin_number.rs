use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{PinNumberWrapper, UnitResult};

// Only the MultiUser canister implements this, since only its users approve the payments it pulls
// from their wallets, which they check their PIN ahead of
#[ts_export(user, check_pin_number)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub pin: PinNumberWrapper,
}

pub type Response = UnitResult;
