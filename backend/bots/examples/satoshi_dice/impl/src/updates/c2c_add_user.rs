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
        "Each time you send me ckBTC I will roll a dice between 0 and 250, then based on your dice \
roll I will send you back between 0 and 250% of the amount of ckBTC you sent me.",
        "You can only send up to 10k SATS on each roll and you may only roll 5 times per hour, if \
you exceed these limits I will simply refund you without rolling the dice.",
        "Go ahead! Roll the dice! 🎲",
    ]
}
