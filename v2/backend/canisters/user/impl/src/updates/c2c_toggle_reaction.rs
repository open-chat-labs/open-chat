use crate::model::events::ToggleReactionResult;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::c2c_toggle_reaction::{Response::*, *};

#[update]
fn c2c_toggle_reaction(args: Args) -> Response {
    check_cycles_balance();

    if args.reaction.is_valid() {
        RUNTIME_STATE.with(|state| c2c_toggle_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
    } else {
        InvalidReaction
    }
}

fn c2c_toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let now = runtime_state.env.now();

        let added = match chat
            .events
            .toggle_reaction(false, args.message_id, args.reaction.clone(), now)
        {
            ToggleReactionResult::Added => true,
            ToggleReactionResult::Removed => false,
            ToggleReactionResult::MessageNotFound => return MessageNotFound,
        };

        if added != args.added {
            // We need to ensure the reaction is saved in this canister in the same state as it is
            // in the sender's canister. If they don't match, toggle the reaction again. This only
            // comes into play in the event that an error happened during a previous attempt to send
            // the reaction c2c.
            chat.events.toggle_reaction(false, args.message_id, args.reaction, now);
        }

        if added {
            Added
        } else {
            Removed
        }
    } else {
        ChatNotFound
    }
}
