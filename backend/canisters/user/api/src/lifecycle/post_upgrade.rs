use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, ReferralStatus, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(default)]
    pub referred_by: Option<UserId>,
    #[serde(default)]
    pub referrals: HashMap<UserId, ReferralStatus>,
    pub wasm_version: BuildVersion,
}
