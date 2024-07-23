use crate::{mutate_state, RuntimeState};
use airdrop_bot_canister::handle_direct_message::*;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{BotMessage, MessageContentInitial, TextContent};

#[update(msgpack = true)]
#[trace]
fn handle_direct_message(_args: Args) -> Response {
    mutate_state(handle_message)
}

fn handle_message(state: &mut RuntimeState) -> Response {
    let text = "Hi, I am the bot which conducts the CHIT for CHAT airdrops. For information about CHIT and the aridrops please read [this blog post](https://oc.app/blog/chit).".to_string();
    Success(SuccessResult {
        bot_name: state.data.username.clone(),
        bot_display_name: None,
        messages: vec![BotMessage {
            thread_root_message_id: None,
            content: MessageContentInitial::Text(TextContent { text }),
            message_id: None,
            block_level_markdown: None,
        }],
    })
}