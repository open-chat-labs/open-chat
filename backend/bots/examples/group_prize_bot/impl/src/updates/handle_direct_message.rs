use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_prize_bot::handle_direct_message::*;
use types::{BotMessage, MessageContent, TextContent};

#[update_msgpack]
#[trace]
fn handle_direct_message(_args: Args) -> Response {
    mutate_state(handle_message)
}

fn handle_message(state: &mut RuntimeState) -> Response {
    let text = "Keep an eye out for prize messages in public groups - you've got to be quick to claim a prize!".to_string();
    Success(SuccessResult {
        bot_name: state.data.username.clone(),
        messages: vec![BotMessage {
            content: MessageContent::Text(TextContent { text }),
        }],
    })
}
