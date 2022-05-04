use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ToggleReactionResult;
use ic_cdk_macros::update;
use types::UserId;
use user_canister::c2c_toggle_reaction::{Response::*, *};

#[update]
#[trace]
fn c2c_toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| c2c_toggle_reaction_impl(args, state))
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

        let exists = chat.events.reaction_exists(caller, args.message_id, &args.reaction);

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
