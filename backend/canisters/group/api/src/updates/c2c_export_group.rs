use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::UserId;

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
// serialized after the `GroupChatCore` rather than wrapped with it, so that communities which only
// deserialize the `GroupChatCore` ignore it, and groups which don't export it send nothing after
// the `GroupChatCore`.
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct ExportExtras {
    pub former_members: Vec<UserId>,
    // Each migration from a user's old id to their new id
    pub migrated_user_ids: Vec<(UserId, UserId)>,
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
            former_members: vec![user_id(2)],
            migrated_user_ids: vec![(user_id(3), user_id(4))],
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
        assert_eq!(extras.former_members, vec![user_id(2)]);
        assert_eq!(extras.migrated_user_ids, vec![(user_id(3), user_id(4))]);
    }

    #[test]
    fn nothing_remains_after_the_chat_in_an_export_without_extras() {
        let bytes = msgpack::serialize_then_unwrap(chat());
        let mut remaining = bytes.as_slice();

        let chat: Chat = msgpack::deserialize(&mut remaining).unwrap();

        assert_eq!(chat, self::chat());
        assert!(remaining.is_empty());
    }
}
