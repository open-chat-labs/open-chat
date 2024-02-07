use candid::Principal;
use types::{CanisterId, Cycles, UserId};

// This only applies to the 'top level' canisters (ie. not user + group canisters)
pub fn min_cycles_balance(test_mode: bool) -> Cycles {
    if test_mode {
        MIN_CYCLES_BALANCE_TEST
    } else {
        MIN_CYCLES_BALANCE
    }
}

const MIN_CYCLES_BALANCE: Cycles = 50_000_000_000_000; // 50T
const MIN_CYCLES_BALANCE_TEST: Cycles = MIN_CYCLES_BALANCE / 10; // 5T
pub const CREATE_CANISTER_CYCLES_FEE: Cycles = 100_000_000_000; // 0.1T cycles
pub const CYCLES_REQUIRED_FOR_UPGRADE: Cycles = 120_000_000_000; // 0.12T cycles

pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));
pub const OPENCHAT_BOT_USERNAME: &str = "OpenChatBot";

pub const SNS_ROOT_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 23, 1, 1]);
pub const SNS_GOVERNANCE_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 24, 1, 1]);
pub const SNS_LEDGER_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 25, 1, 1]);

pub const DEV_TEAM_DFX_PRINCIPAL: CanisterId = Principal::from_slice(&[
    143, 216, 195, 195, 27, 134, 102, 49, 184, 154, 196, 117, 143, 40, 192, 164, 121, 209, 89, 30, 45, 18, 30, 32, 92, 106,
    138, 30, 2,
]);

pub const MEMO_MESSAGE: [u8; 6] = [0x4f, 0x43, 0x5f, 0x4d, 0x53, 0x47]; // OC_MSG
pub const MEMO_SEND: [u8; 7] = [0x4f, 0x43, 0x5f, 0x53, 0x45, 0x4e, 0x44]; // OC_SEND
pub const MEMO_TIP: [u8; 6] = [0x4f, 0x43, 0x5f, 0x54, 0x49, 0x50]; // OC_TIP
pub const MEMO_PRIZE: [u8; 6] = [0x4f, 0x43, 0x5f, 0x50, 0x52, 0x5a]; // OC_PRZ
pub const MEMO_PRIZE_CLAIM: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x52, 0x5a, 0x43, 0x4c]; // OC_PRZCL
pub const MEMO_PRIZE_REFUND: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x52, 0x5a, 0x52, 0x46]; // OC_PRZRF
pub const MEMO_SWAP: [u8; 7] = [0x4F, 0x43, 0x5F, 0x53, 0x57, 0x41, 0x50]; // OC_SWAP
pub const MEMO_JOINING_FEE: [u8; 7] = [0x4f, 0x43, 0x5f, 0x4A, 0x4F, 0x49, 0x4E]; // OC_JOIN
pub const MEMO_P2P_SWAP_CREATE: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x32, 0x50, 0x53, 0x43]; // OC_P2PSC
pub const MEMO_P2P_SWAP_ACCEPT: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x32, 0x50, 0x53, 0x41]; // OC_P2PSA
pub const MEMO_TRANSLATION_PAYMENT: [u8; 7] = [0x4f, 0x43, 0x5f, 0x54, 0x52, 0x41, 0x4e]; // OC_TRAN
pub const MEMO_GROUP_IMPORT_INTO_COMMUNITY: [u8; 6] = [0x4f, 0x43, 0x5f, 0x47, 0x32, 0x43]; // OC_G2C

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openchatbot_user_id() {
        assert_eq!(
            OPENCHAT_BOT_USER_ID,
            UserId::new(Principal::from_text("zzyk3-openc-hatbo-tq7my-cai").unwrap())
        );
    }

    #[test]
    fn sns_root_canister_id() {
        assert_eq!(
            SNS_ROOT_CANISTER_ID,
            Principal::from_text("3e3x2-xyaaa-aaaaq-aaalq-cai").unwrap()
        );
    }

    #[test]
    fn sns_governance_canister_id() {
        assert_eq!(
            SNS_GOVERNANCE_CANISTER_ID,
            Principal::from_text("2jvtu-yqaaa-aaaaq-aaama-cai").unwrap()
        );
    }

    #[test]
    fn sns_ledger_canister_id() {
        assert_eq!(
            SNS_LEDGER_CANISTER_ID,
            Principal::from_text("2ouva-viaaa-aaaaq-aaamq-cai").unwrap()
        );
    }

    #[test]
    fn dev_team_dfx_principal() {
        assert_eq!(
            DEV_TEAM_DFX_PRINCIPAL,
            Principal::from_text("tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae").unwrap()
        );
    }
}
