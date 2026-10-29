use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, MiniAppContent};

// The MiniApp service posting a card as a bot, with the bot's post token from `bot_mini_app_post_token`.
// The card is sent finalised, as every card is.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub token: String,
    pub content: MiniAppContent,
    pub block_level_markdown: bool,
    pub replies_to: Option<EventIndex>,
}

pub type Response = super::bot_send_message::Response;
