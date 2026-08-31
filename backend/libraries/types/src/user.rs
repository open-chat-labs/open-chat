use crate::CanisterId;
use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Display, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UserId(pub(crate) Principal);

// Canister ids are a big-endian u64 followed by the IC's canister and opaque class tags, so they
// are always exactly this long.
const CANISTER_ID_LEN: usize = 10;
// Set in the final byte to mark a UserId as carrying an index. The final byte of a well-formed
// principal is its class tag, and every class tag the IC defines is in 0x01..=0x04, so a byte with
// the top bit set cannot be one. That leaves the low 7 bits of this byte, plus all 8 bits of the
// byte before it, to hold the index.
const INDEXED_TAG: u8 = 0x80;
pub const MAX_USER_INDEX: u16 = (1 << 15) - 1;

impl UserId {
    // The id of a user who is not held alongside others - a canister id where that canister holds
    // the user alone, and otherwise whatever principal identifies them, eg. a bot or a webhook.
    // Use `new_indexed` for a user sharing a canister.
    pub const fn new(principal: Principal) -> UserId {
        UserId(principal)
    }

    // A user whose data is held alongside other users' in a single canister is identified by that
    // canister's leading u64 followed by the user's index within it, the index taking the place of
    // the canister id's two trailing tag bytes. The result is deliberately not a well-formed
    // principal, which is exactly what tells it apart from a canister id - see `is_indexed`.
    pub fn new_indexed(canister_id: CanisterId, index: u16) -> UserId {
        let bytes = canister_id.as_slice();
        assert_eq!(bytes.len(), CANISTER_ID_LEN, "Not a canister id: {canister_id}");
        assert!(index <= MAX_USER_INDEX, "Index {index} is out of range");

        let mut new_bytes = [0; CANISTER_ID_LEN];
        new_bytes[..8].copy_from_slice(&bytes[..8]);
        new_bytes[8] = index as u8;
        new_bytes[9] = INDEXED_TAG | (index >> 8) as u8;
        UserId(Principal::from_slice(&new_bytes))
    }

    // The id's own bytes, ie. the user's identity as it goes over the wire. Only equal to the
    // holding canister's id when that canister holds this user alone, so never use this to address
    // a canister - `canister_id` does that.
    pub fn as_principal(&self) -> Principal {
        self.0
    }

    pub fn as_slice(&self) -> &[u8] {
        self.0.as_slice()
    }

    // The canister which holds this user's data.
    pub fn canister_id(&self) -> CanisterId {
        if self.is_indexed() {
            // Rebuilding the canister id means restoring the two tag bytes the index displaced.
            let mut bytes = [0x01; CANISTER_ID_LEN];
            bytes[..8].copy_from_slice(&self.0.as_slice()[..8]);
            Principal::from_slice(&bytes)
        } else {
            self.0
        }
    }

    // The user's index within the canister which holds their data. Zero when that canister holds
    // this user alone.
    pub fn index(&self) -> u16 {
        if self.is_indexed() {
            let bytes = self.0.as_slice();
            u16::from(bytes[8]) | (u16::from(bytes[9] & !INDEXED_TAG) << 8)
        } else {
            0
        }
    }

    // A UserId carries an index iff it is canister id length and its final byte is tagged. Every
    // canister id ends in the opaque class tag, and so do the vanity principals behind
    // `OPENCHAT_BOT_USER_ID` and `DELETED_USER_ID`; bot and webhook ids are 8 bytes. So all of
    // those read back as index 0, which is what keeps this backwards compatible.
    fn is_indexed(&self) -> bool {
        let bytes = self.0.as_slice();
        bytes.len() == CANISTER_ID_LEN && bytes[CANISTER_ID_LEN - 1] & INDEXED_TAG != 0
    }
}

impl From<Principal> for UserId {
    fn from(principal: Principal) -> Self {
        UserId(principal)
    }
}

impl From<UserId> for Account {
    fn from(value: UserId) -> Self {
        // Index 0 must map to the default subaccount, else every existing user's wallet address
        // would change. Note the owner is the holding canister, never the UserId itself - nobody
        // can sign for an indexed UserId, so tokens sent there would be unrecoverable.
        let subaccount = value.index().to_be_bytes();
        Account {
            owner: value.canister_id(),
            subaccount: (subaccount != [0; 2]).then(|| {
                let mut bytes = [0; 32];
                bytes[30..].copy_from_slice(&subaccount);
                bytes
            }),
        }
    }
}

impl From<UserId> for AccountIdentifier {
    fn from(value: UserId) -> Self {
        let account = Account::from(value);
        AccountIdentifier::new(
            &account.owner,
            &account.subaccount.map_or(ic_ledger_types::DEFAULT_SUBACCOUNT, Subaccount),
        )
    }
}

impl Debug for UserId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl Display for UserId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub user_id: UserId,
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct UserDetails {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub is_bot: bool,
    pub is_platform_moderator: bool,
    pub is_platform_operator: bool,
    pub is_diamond_member: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum UserType {
    #[default]
    User,
    BotV2,
    Bot,
    OcControlledBot,
    Webhook,
}

impl UserType {
    pub fn is_bot(&self) -> bool {
        !matches!(self, UserType::User)
    }

    pub fn is_oc_controlled_bot(&self) -> bool {
        matches!(self, UserType::OcControlledBot)
    }

    pub fn is_3rd_party_bot(&self) -> bool {
        matches!(self, UserType::BotV2 | UserType::Bot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn canister_id() -> CanisterId {
        CanisterId::from_text("dfdal-2uaaa-aaaaa-qaama-cai").unwrap()
    }

    #[test]
    fn canister_id_reads_back_as_index_zero() {
        let user_id = UserId::new(canister_id());

        assert_eq!(user_id.canister_id(), canister_id());
        assert_eq!(user_id.index(), 0);
    }

    // Bot and webhook ids are 8 random bytes, so most of them do not end in the opaque tag. Only
    // the length check stops them being read as indexed.
    #[test]
    fn bot_style_user_id_reads_back_as_index_zero() {
        for last_byte in [0, 1, 42, 255] {
            let user_id = UserId::from(Principal::from_slice(&[9, 8, 7, 6, 5, 4, 3, last_byte]));

            assert_eq!(user_id.index(), 0, "last byte {last_byte}");
            assert_eq!(
                user_id.canister_id(),
                Principal::from_slice(&[9, 8, 7, 6, 5, 4, 3, last_byte])
            );
        }
    }

    // These are the byte patterns behind `OPENCHAT_BOT_USER_ID` and `DELETED_USER_ID`. They are
    // vanity principals whose 9th byte is not the usual 0x01, which is why the trailing pair
    // cannot be used to tell an indexed UserId from a canister id.
    #[test]
    fn vanity_user_ids_read_back_as_index_zero() {
        for bytes in [
            [228, 104, 142, 9, 133, 211, 135, 217, 129, 1],
            [139, 36, 200, 58, 72, 145, 241, 66, 97, 1],
        ] {
            let user_id = UserId::from(Principal::from_slice(&bytes));

            assert_eq!(user_id.index(), 0, "{bytes:?}");
            assert_eq!(user_id.canister_id(), Principal::from_slice(&bytes));
        }
    }

    #[test]
    fn indexed_user_id_round_trips() {
        for index in [1, 2, 255, 256, 257, 1000, 1024, MAX_USER_INDEX] {
            let user_id = UserId::new_indexed(canister_id(), index);

            assert_eq!(user_id.canister_id(), canister_id(), "index {index}");
            assert_eq!(user_id.index(), index);
            assert_ne!(user_id, UserId::new(canister_id()));
        }
    }

    #[test]
    fn indexed_user_ids_are_unique_across_canisters() {
        let other = CanisterId::from_text("2ouva-viaaa-aaaaq-aaamq-cai").unwrap();

        assert_ne!(UserId::new_indexed(canister_id(), 1000), UserId::new_indexed(other, 1000));
    }

    // Only 15 bits are available, the 16th being the tag which marks the id as indexed.
    #[test]
    #[should_panic(expected = "Index 32768 is out of range")]
    fn index_beyond_the_available_bits_is_rejected() {
        UserId::new_indexed(canister_id(), MAX_USER_INDEX + 1);
    }

    #[test]
    fn account_for_unindexed_user_is_unchanged() {
        let account = Account::from(UserId::new(canister_id()));

        assert_eq!(account.owner, canister_id());
        assert_eq!(account.subaccount, None);
    }

    #[test]
    fn account_for_indexed_user_is_a_subaccount_of_the_holding_canister() {
        let account = Account::from(UserId::new_indexed(canister_id(), 1000));

        assert_eq!(account.owner, canister_id());
        let mut expected = [0; 32];
        expected[30..].copy_from_slice(&1000u16.to_be_bytes());
        assert_eq!(account.subaccount, Some(expected));
    }
}
