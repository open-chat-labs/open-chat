use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::ToggleReactionResult;
use ic_cdk_macros::update;
use tracing::instrument;
use types::UserId;
use user_canister::c2c_toggle_reaction::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn c2c_toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        RUNTIME_STATE.with(|state| c2c_toggle_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
    } else {
        InvalidReaction
    }
}

fn c2c_toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller: UserId = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&caller) {
        return UserBlocked;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let now = runtime_state.env.now();

        let exists = chat.events.reaction_exists(caller, &args.message_id, &args.reaction);

        if exists == args.added {
            return if args.added { Added } else { Removed };
        }

        match chat.events.toggle_reaction(caller, args.message_id, args.reaction, now) {
            ToggleReactionResult::Added(_) => Added,
            ToggleReactionResult::Removed(_) => Removed,
            ToggleReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
