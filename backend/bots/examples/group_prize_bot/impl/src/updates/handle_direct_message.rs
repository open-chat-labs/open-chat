use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_prize_bot::handle_direct_message::*;
use types::{BotMessage, MessageContentInitial, TextContent};

#[update(msgpack = true)]
#[trace]
fn handle_direct_message(_args: Args) -> Response {
    mutate_state(handle_message)
}

fn handle_message(state: &mut RuntimeState) -> Response {
    let text = "Keep an eye out for prize messages in public groups - you've got to be quick to claim a prize!".to_string();
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
