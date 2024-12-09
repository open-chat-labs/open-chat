use crate::{
    AudioContent, FileContent, GiphyContent, ImageContent, MessagePermission, PollContent, SlashCommandPermissions,
    TextContent, VideoContent,
};
use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotAction {
    SendMessage(MessageContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContent),
    Giphy(GiphyContent),
}

impl BotAction {
    pub fn permissions_required(&self, in_thread: bool) -> SlashCommandPermissions {
        let mut permissions_required = SlashCommandPermissions::default();

        match self {
            BotAction::SendMessage(content) => {
                let permission = match content {
                    MessageContent::Text(_) => MessagePermission::Text,
                    MessageContent::Image(_) => MessagePermission::Image,
                    MessageContent::Video(_) => MessagePermission::Video,
                    MessageContent::Audio(_) => MessagePermission::Audio,
                    MessageContent::File(_) => MessagePermission::File,
                    MessageContent::Poll(_) => MessagePermission::Poll,
                    MessageContent::Giphy(_) => MessagePermission::Giphy,
                };

                if in_thread {
                    permissions_required.thread.insert(permission);
                } else {
                    permissions_required.message.insert(permission);
                }
            }
        };

        permissions_required
    }
}
