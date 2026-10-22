use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BridgePlatform, TimestampMillis};

// For a user to start linking their account on another platform, eg. Discord, to their OpenChat
// account. They pass the code to the platform's bridge bot, eg. as the `state` of Discord's OAuth
// consent page, or in a Telegram deep link. Once the bot knows whose account it is, it redeems the
// code with `link_bridged_user`. The code can be used once, for 10 minutes, and replaces any the
// user was given earlier for the platform. A user can link one account per platform, so this is
// refused while they have one linked there.
#[ts_export(user_index, start_bridged_user_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub platform: BridgePlatform,
}

#[ts_export(user_index, start_bridged_user_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user_index, start_bridged_user_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub code: String,
    pub expires: TimestampMillis,
}
