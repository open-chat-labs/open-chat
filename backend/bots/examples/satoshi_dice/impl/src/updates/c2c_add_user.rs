use crate::guards::caller_is_local_user_index;
use crate::model::pending_actions_queue::Action;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use satoshi_dice_canister::c2c_add_user::{Response::*, *};
use types::{MessageContent, TextContent, UserId};

#[update_msgpack(guard = "caller_is_local_user_index")]
#[trace]
fn c2c_add_user(args: Args) -> Response {
    mutate_state(|state| c2c_add_user_impl(args.user_id, state))
}

pub(crate) fn c2c_add_user_impl(user_id: UserId, state: &mut RuntimeState) -> Response {
    state.data.users.add_user(user_id, state.env.now());
    state.enqueue_pending_action(Action::SendMessages(
        user_id,
        welcome_messages()
            .iter()
            .map(|m| MessageContent::Text(TextContent { text: m.to_string() }))
            .collect(),
    ));
    Success
}

fn welcome_messages() -> Vec<&'static str> {
    vec![
        "Hey there! I am the SatoshiDice bot!",
        "I am here to help you experiment with sending ckBTC as a chat message. Simply send me some \
ckBTC (up to 10k SATS) and you will receive your SATS back with a surprise bonus on top within just \
a few moments!",
        "Start playing now! 🎲",
    ]
}
