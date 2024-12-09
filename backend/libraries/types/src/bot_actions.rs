use crate::{MessagePermission, SlashCommandPermissions};
use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotAction {
    SendTextMessage(SendTextMessageArgs),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SendTextMessageArgs {
    pub text: String,
}

impl BotAction {
    pub fn permissions_required(&self, in_thread: bool) -> SlashCommandPermissions {
        let mut permissions_required = SlashCommandPermissions::default();

        match self {
            BotAction::SendTextMessage(_) => {
                if in_thread {
                    permissions_required.thread.insert(MessagePermission::Text);
                } else {
                    permissions_required.message.insert(MessagePermission::Text);
                }
            }
        };

        permissions_required
    }
}
