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
