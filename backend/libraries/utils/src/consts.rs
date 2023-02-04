use candid::Principal;
use types::{Cycles, UserId};

// This only applies to the 'top level' canisters (ie. not user + group canisters)
pub const MIN_CYCLES_BALANCE: Cycles = 50_000_000_000_000; // 50T
pub const CREATE_CANISTER_CYCLES_FEE: Cycles = 100_000_000_000; // 0.1T cycles
pub const CYCLES_REQUIRED_FOR_UPGRADE: Cycles = 80_000_000_000; // 0.08T cycles

// zzyk3-openc-hatbo-tq7my-cai
pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));
pub const OPENCHAT_BOT_USERNAME: &str = "OpenChatBot";
