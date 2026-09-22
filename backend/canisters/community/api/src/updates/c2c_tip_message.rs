use serde::{Deserialize, Serialize};
use types::{CanisterId, ChannelId, MessageId, MessageIndex, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub amount: u128,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
    // The user being acted for when the caller holds many users, which must be one of its users
    #[serde(default)]
    pub user_id: Option<UserId>,
}

pub type Response = UnitResult;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_from_the_previous_args() {
        #[derive(Serialize)]
        struct PreviousArgs {
            recipient: UserId,
            channel_id: ChannelId,
            thread_root_message_index: Option<MessageIndex>,
            message_id: MessageId,
            ledger: CanisterId,
            token_symbol: String,
            amount: u128,
            decimals: u8,
            username: String,
            display_name: Option<String>,
        }

        let recipient = CanisterId::from_slice(&[1]).into();
        let args: Args = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(PreviousArgs {
            recipient,
            channel_id: 1u32.into(),
            thread_root_message_index: None,
            message_id: 1u64.into(),
            ledger: CanisterId::from_slice(&[2]),
            token_symbol: "ICP".to_string(),
            amount: 100,
            decimals: 8,
            username: "tipper".to_string(),
            display_name: None,
        }));
        assert_eq!(args.recipient, recipient);
        assert_eq!(args.amount, 100);
        assert!(args.user_id.is_none());
    }
}
