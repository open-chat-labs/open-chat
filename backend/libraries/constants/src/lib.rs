use candid::Principal;
use types::{CanisterId, Cycles, Milliseconds, TimestampMillis, UserId};

pub const SECOND_IN_MS: Milliseconds = 1000;
pub const MINUTE_IN_MS: Milliseconds = SECOND_IN_MS * 60;
pub const HOUR_IN_MS: Milliseconds = MINUTE_IN_MS * 60;
pub const DAY_IN_MS: Milliseconds = HOUR_IN_MS * 24;
pub const WEEK_IN_MS: Milliseconds = DAY_IN_MS * 7;
pub const NANOS_PER_MILLISECOND: u64 = 1_000_000;
pub const ONE_MB: u32 = 1024 * 1024;

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
pub const CREATE_CANISTER_CYCLES_FEE: Cycles = 500_000_000_000; // 0.5T cycles
pub const CYCLES_REQUIRED_FOR_UPGRADE: Cycles = 300_000_000_000; // 0.3T cycles

pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));
pub const DELETED_USER_ID: UserId = UserId::new(Principal::from_slice(&[139, 36, 200, 58, 72, 145, 241, 66, 97, 1]));
pub const OPENCHAT_BOT_USERNAME: &str = "OpenChatBot";
pub const OPENCHAT_TREASURY_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 48, 2, 238, 1, 1]);

pub const SNS_ROOT_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 23, 1, 1]);
pub const SNS_GOVERNANCE_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 24, 1, 1]);
pub const SNS_LEDGER_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 25, 1, 1]);

pub const DEV_TEAM_DFX_PRINCIPAL: CanisterId = Principal::from_slice(&[
    143, 216, 195, 195, 27, 134, 102, 49, 184, 154, 196, 117, 143, 40, 192, 164, 121, 209, 89, 30, 45, 18, 30, 32, 92, 106,
    138, 30, 2,
]);

pub const IC_ROOT_KEY: &[u8; 133] = b"\x30\x81\x82\x30\x1d\x06\x0d\x2b\x06\x01\x04\x01\x82\xdc\x7c\x05\x03\x01\x02\x01\x06\x0c\x2b\x06\x01\x04\x01\x82\xdc\x7c\x05\x03\x02\x01\x03\x61\x00\x81\x4c\x0e\x6e\xc7\x1f\xab\x58\x3b\x08\xbd\x81\x37\x3c\x25\x5c\x3c\x37\x1b\x2e\x84\x86\x3c\x98\xa4\xf1\xe0\x8b\x74\x23\x5d\x14\xfb\x5d\x9c\x0c\xd5\x46\xd9\x68\x5f\x91\x3a\x0c\x0b\x2c\xc5\x34\x15\x83\xbf\x4b\x43\x92\xe4\x67\xdb\x96\xd6\x5b\x9b\xb4\xcb\x71\x71\x12\xf8\x47\x2e\x0d\x5a\x4d\x14\x50\x5f\xfd\x74\x84\xb0\x12\x91\x09\x1c\x5f\x87\xb9\x88\x83\x46\x3f\x98\x09\x1a\x0b\xaa\xae";

pub const MEMO_MESSAGE: [u8; 6] = [0x4f, 0x43, 0x5f, 0x4d, 0x53, 0x47]; // OC_MSG
pub const MEMO_SEND: [u8; 7] = [0x4f, 0x43, 0x5f, 0x53, 0x45, 0x4e, 0x44]; // OC_SEND
pub const MEMO_TIP: [u8; 6] = [0x4f, 0x43, 0x5f, 0x54, 0x49, 0x50]; // OC_TIP
pub const MEMO_PRIZE: [u8; 6] = [0x4f, 0x43, 0x5f, 0x50, 0x52, 0x5a]; // OC_PRZ
pub const MEMO_PRIZE_CLAIM: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x52, 0x5a, 0x43, 0x4c]; // OC_PRZCL
pub const MEMO_PRIZE_REFUND: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x52, 0x5a, 0x52, 0x46]; // OC_PRZRF
pub const MEMO_PRIZE_FEE: [u8; 9] = [0x4f, 0x43, 0x5f, 0x50, 0x52, 0x5a, 0x46, 0x45, 0x45]; // OC_PRZFEE
pub const MEMO_SWAP: [u8; 7] = [0x4F, 0x43, 0x5F, 0x53, 0x57, 0x41, 0x50]; // OC_SWAP
pub const MEMO_SWAP_APPROVAL: [u8; 8] = [0x4F, 0x43, 0x5F, 0x53, 0x57, 0x41, 0x50, 0x41]; // OC_SWAPA
pub const MEMO_JOINING_FEE: [u8; 7] = [0x4f, 0x43, 0x5f, 0x4A, 0x4F, 0x49, 0x4E]; // OC_JOIN
pub const MEMO_P2P_SWAP_CREATE: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x32, 0x50, 0x53, 0x43]; // OC_P2PSC
pub const MEMO_P2P_SWAP_ACCEPT: [u8; 8] = [0x4f, 0x43, 0x5f, 0x50, 0x32, 0x50, 0x53, 0x41]; // OC_P2PSA
pub const MEMO_TRANSLATION_PAYMENT: [u8; 7] = [0x4f, 0x43, 0x5f, 0x54, 0x52, 0x41, 0x4e]; // OC_TRAN
pub const MEMO_GROUP_IMPORT_INTO_COMMUNITY: [u8; 6] = [0x4f, 0x43, 0x5f, 0x47, 0x32, 0x43]; // OC_G2C
pub const MEMO_CHIT_FOR_CHAT_AIRDROP: [u8; 6] = [0x4f, 0x43, 0x5f, 0x41, 0x49, 0x52]; // OC_AIR
pub const MEMO_CHIT_FOR_CHAT_LOTTERY: [u8; 6] = [0x4f, 0x43, 0x5f, 0x4C, 0x4F, 0x54]; // OC_LOT
pub const MEMO_LIST_TOKEN: [u8; 6] = [0x4f, 0x43, 0x5f, 0x54, 0x4f, 0x4b]; // OC_TOK
pub const MEMO_STREAK_INSURANCE: [u8; 6] = [0x4f, 0x43, 0x5f, 0x49, 0x4e, 0x53]; // OC_INS

pub const LIFETIME_DIAMOND_TIMESTAMP: TimestampMillis = 30000000000000; // This timestamp is in the year 2920

pub const PRIZE_FEE_PERCENT: u8 = 5;

// The length of time to hold on to data required to compile chat summary updates, eg. event last
// updated timestamps
pub const DURATION_TO_MAINTAIN_SUMMARY_UPDATES_DATA: Milliseconds = 31 * DAY_IN_MS;

pub fn calculate_summary_updates_data_removal_cutoff(now: TimestampMillis) -> Milliseconds {
    now.saturating_sub(DURATION_TO_MAINTAIN_SUMMARY_UPDATES_DATA)
}

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
    fn deleted_user_id() {
        assert_eq!(
            DELETED_USER_ID,
            UserId::new(Principal::from_text("zzvcw-delet-eduse-r6fbg-cai").unwrap())
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

    #[test]
    fn openchat_treasury_canister_id() {
        assert_eq!(
            OPENCHAT_TREASURY_CANISTER_ID,
            Principal::from_text("nafek-diaaa-aaaar-qalxa-cai").unwrap()
        );
    }
}
