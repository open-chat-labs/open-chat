use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    ChannelId, CompletedCryptoTransaction, EventIndex, GroupReplyContext, MessageContentInitial, MessageId, MessageIndex,
    OgPreview, TimestampMillis, User, Version,
};

// A message holding a transfer (Crypto, Prize or P2PSwap content) is one the caller makes from their
// own funds, which the community makes before sending the message. The community never pays from
// its own account for a member, so the transfer of a crypto or prize message must be either:
// - ICRC2: pulled by the community from an account which has approved it as spender, naming as the
//   spender's subaccount the caller's own (see `ledger_utils::spender_subaccount`). The community
//   only spends approvals made under the subaccount of the user calling it.
// - Certified: made by the caller already, calling `icrc1_transfer` on the ledger with the memo
//   `ledger_utils::certified::required_memo` builds from the message type's memo (OC_MSG or OC_PRZ)
//   and the community's canister id.
// A crypto transfer must be to the recipient's wallet, and a prize to the community's default
// account. A P2P swap is funded via ICRC2 from its `from_account`, which defaults to the caller's
// wallet.
#[ts_export(community, send_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    pub community_rules_accepted: Option<Version>,
    pub channel_rules_accepted: Option<Version>,
    pub message_filter_failed: Option<u64>,
    pub new_achievement: bool,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
}

#[ts_export(community, send_message)]
#[derive(Serialize, Deserialize, Debug)]
#[expect(clippy::large_enum_variant)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, send_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    // The transfer the community made for the message, if it holds one
    #[serde(default)]
    pub transfer: Option<CompletedCryptoTransaction>,
}
