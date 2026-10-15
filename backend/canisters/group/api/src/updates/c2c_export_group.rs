use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::{MessageIndex, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: u64,
    pub page_size: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ByteBuf),
}

// The group's state which is exported alongside its `GroupChatCore` but lives outside of it. It is
// serialized after the `GroupChatCore` rather than wrapped with it.
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct ExportExtras {
    // What the group's chat holds in stable memory which isn't carried over with its events: each
    // user's metrics, and the chunks of each events list's message event indexes, keyed by the root
    // message of its thread, or None for the main events list
    pub user_metrics: Vec<(UserId, ByteBuf)>,
    pub message_event_index_chunks: Vec<(Option<MessageIndex>, Vec<ByteBuf>)>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_principal::Principal;

    // Stands in for the `GroupChatCore`, which is likewise serialized as a map
    #[derive(Serialize, Deserialize, Debug, PartialEq)]
    struct Chat {
        name: String,
        members: Vec<UserId>,
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn chat() -> Chat {
        Chat {
            name: "group".to_string(),
            members: vec![user_id(1)],
        }
    }

    fn export_with_extras() -> Vec<u8> {
        let mut bytes = msgpack::serialize_then_unwrap(chat());
        let extras = ExportExtras {
            user_metrics: vec![(user_id(3), ByteBuf::from(vec![4]))],
            ..Default::default()
        };
        msgpack::serialize(&extras, &mut bytes).unwrap();
        bytes
    }

    #[test]
    fn chat_alone_can_be_deserialized_from_an_export_with_extras() {
        let chat: Chat = msgpack::deserialize_then_unwrap(&export_with_extras());

        assert_eq!(chat, self::chat());
    }

    #[test]
    fn extras_are_deserialized_from_the_bytes_after_the_chat() {
        let bytes = export_with_extras();
        let mut remaining = bytes.as_slice();

        let chat: Chat = msgpack::deserialize(&mut remaining).unwrap();
        let extras: ExportExtras = msgpack::deserialize_then_unwrap(remaining);

        assert_eq!(chat, self::chat());
        assert_eq!(extras.user_metrics, vec![(user_id(3), ByteBuf::from(vec![4]))]);
    }
}
