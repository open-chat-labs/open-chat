use types::{ChannelId, Chat, ChatId, CommunityId, MessageIndex};

pub fn build_message_link(
    chat_id: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
) -> String {
    match chat_id {
        Chat::Direct(chat_id) => build_direct_message_link(chat_id, message_index),
        Chat::Group(chat_id) => build_group_message_link(chat_id, thread_root_message_index, message_index),
        Chat::Channel(community_id, channel_id) => {
            build_channel_message_link(community_id, channel_id, thread_root_message_index, message_index)
        }
    }
}

fn build_direct_message_link(chat_id: ChatId, message_index: MessageIndex) -> String {
    build_deep_link(format!("/user/{chat_id}/{message_index}"))
}

fn build_group_message_link(
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
) -> String {
    build_deep_link(format!(
        "/group/{}/{}",
        chat_id,
        build_message_path(thread_root_message_index, message_index)
    ))
}

fn build_channel_message_link(
    community_id: CommunityId,
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
) -> String {
    build_deep_link(format!(
        "/community/{}/channel/{}/{}",
        community_id,
        channel_id,
        build_message_path(thread_root_message_index, message_index)
    ))
}

fn build_message_path(thread_root_message_index: Option<MessageIndex>, message_index: MessageIndex) -> String {
    if let Some(root) = thread_root_message_index {
        format!("{root}/{message_index}")
    } else {
        message_index.to_string()
    }
}

fn build_deep_link(path: String) -> String {
    format!("https://oc.app{path}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn principal(byte: u8) -> Principal {
        Principal::from_slice(&[byte; 4])
    }

    #[test]
    fn direct_message_link() {
        let chat_id = ChatId::from(principal(1));
        let link = build_message_link(Chat::Direct(chat_id), None, 5.into());
        assert_eq!(link, format!("https://oc.app/user/{chat_id}/5"));
    }

    #[test]
    fn group_message_link() {
        let chat_id = ChatId::from(principal(2));
        let link = build_message_link(Chat::Group(chat_id), None, 7.into());
        assert_eq!(link, format!("https://oc.app/group/{chat_id}/7"));
    }

    #[test]
    fn group_thread_message_link() {
        let chat_id = ChatId::from(principal(3));
        let link = build_message_link(Chat::Group(chat_id), Some(4.into()), 9.into());
        assert_eq!(link, format!("https://oc.app/group/{chat_id}/4/9"));
    }

    #[test]
    fn channel_message_link() {
        let community_id = CommunityId::from(principal(4));
        let channel_id = ChannelId::from(42u32);
        let link = build_message_link(Chat::Channel(community_id, channel_id), None, 11.into());
        assert_eq!(
            link,
            format!("https://oc.app/community/{community_id}/channel/{channel_id}/11")
        );
    }

    #[test]
    fn channel_thread_message_link() {
        let community_id = CommunityId::from(principal(5));
        let channel_id = ChannelId::from(42u32);
        let link = build_message_link(Chat::Channel(community_id, channel_id), Some(2.into()), 13.into());
        assert_eq!(
            link,
            format!("https://oc.app/community/{community_id}/channel/{channel_id}/2/13")
        );
    }
}
