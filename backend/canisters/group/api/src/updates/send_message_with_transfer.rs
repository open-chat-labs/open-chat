use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    CompletedCryptoTransaction, EventIndex, GroupReplyContext, MessageContentInitial, MessageId, MessageIndex, OgPreview,
    TimestampMillis, User, Version,
};

// Sends a message holding a transfer the caller makes from their own funds: crypto sent to another
// member, a prize, or a P2P swap. The group never pays from its own account, so the transfer of a
// crypto or prize message must be either:
// - ICRC2: pulled by the group from an account which has approved it as spender, naming as the
//   spender's subaccount the caller's own (see `ledger_utils::spender_subaccount`). The group only
//   spends approvals made under the subaccount of the user calling it.
// - Certified: made by the caller already, calling `icrc1_transfer` on the ledger with the memo
//   `ledger_utils::certified::required_memo` builds from the message type's memo (OC_MSG or OC_PRZ)
//   and the group's canister id.
// A crypto transfer must be to the recipient's wallet, and a prize to the group's default account.
// A P2P swap is funded via ICRC2 from its `from_account`, which defaults to the caller's wallet.
#[ts_export(group, send_message_with_transfer)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub block_level_markdown: bool,
    pub rules_accepted: Option<Version>,
    pub message_filter_failed: Option<u64>,
    pub new_achievement: bool,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
}

#[ts_export(group, send_message_with_transfer)]
#[derive(Serialize, Deserialize, Debug)]
#[expect(clippy::large_enum_variant)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, send_message_with_transfer)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    pub transfer: CompletedCryptoTransaction,
}
