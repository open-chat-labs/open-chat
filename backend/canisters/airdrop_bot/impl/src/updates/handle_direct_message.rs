use crate::USERNAME;
use airdrop_bot_canister::handle_direct_message::*;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{BotMessage, MessageContentInitial, TextContent};

#[update(msgpack = true)]
#[trace]
fn handle_direct_message(_args: Args) -> Response {
    let text = "Hi, I am the bot which conducts the CHIT for CHAT airdrops. For information about CHIT and the airdrops please read [this blog post](https://oc.app/blog/chit).".to_string();
    Success(SuccessResult {
        bot_name: USERNAME.to_string(),
        bot_display_name: None,
        messages: vec![BotMessage {
            thread_root_message_id: None,
            content: MessageContentInitial::Text(TextContent { text }),
            message_id: None,
            block_level_markdown: None,
        }],
    })
}
