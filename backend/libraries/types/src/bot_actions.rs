use crate::{
    AudioContent, FileContent, GiphyContent, ImageContent, MessagePermission, PollContent, BotPermissions,
    TextContent, VideoContent,
};
use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotAction {
    SendMessage(BotMessageAction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotMessageAction {
    pub content: MessageContent,
    pub finalised: bool,
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
    pub fn permissions_required(&self) -> BotPermissions {
        let mut permissions_required = BotPermissions::default();

        match self {
            BotAction::SendMessage(action) => {
                let permission = match action.content {
                    MessageContent::Text(_) => MessagePermission::Text,
                    MessageContent::Image(_) => MessagePermission::Image,
                    MessageContent::Video(_) => MessagePermission::Video,
                    MessageContent::Audio(_) => MessagePermission::Audio,
                    MessageContent::File(_) => MessagePermission::File,
                    MessageContent::Poll(_) => MessagePermission::Poll,
                    MessageContent::Giphy(_) => MessagePermission::Giphy,
                };

                permissions_required.message.insert(permission);
            }
        };

        permissions_required
    }
}
