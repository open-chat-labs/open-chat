use crate::model::events::ToggleReactionResult;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::toggle_reaction::{Response::*, *};

#[update]
fn c2c_toggle_reaction(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| c2c_toggle_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let now = runtime_state.env.now();

        match chat.events.toggle_reaction(false, args.message_id, args.reaction, now) {
            ToggleReactionResult::Added => Added,
            ToggleReactionResult::Removed => Added,
            ToggleReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
