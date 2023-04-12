use candid::Principal;
use types::{CanisterId, Cycles, UserId};

// This only applies to the 'top level' canisters (ie. not user + group canisters)
pub const MIN_CYCLES_BALANCE: Cycles = 50_000_000_000_000; // 50T
pub const CREATE_CANISTER_CYCLES_FEE: Cycles = 100_000_000_000; // 0.1T cycles
pub const CYCLES_REQUIRED_FOR_UPGRADE: Cycles = 80_000_000_000; // 0.08T cycles

pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));
pub const OPENCHAT_BOT_USERNAME: &str = "OpenChatBot";

pub const SNS_GOVERNANCE_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 24, 1, 1]);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sns_governance_canister_id() {
        assert_eq!(
            SNS_GOVERNANCE_CANISTER_ID,
            Principal::from_text("2jvtu-yqaaa-aaaaq-aaama-cai").unwrap()
        );
    }

    #[test]
    fn openchatbot_user_id() {
        assert_eq!(
            OPENCHAT_BOT_USER_ID,
            UserId::new(Principal::from_text("zzyk3-openc-hatbo-tq7my-cai").unwrap())
        );
    }
}
