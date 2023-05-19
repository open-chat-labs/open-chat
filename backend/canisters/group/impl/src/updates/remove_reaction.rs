use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::remove_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn remove_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_reaction_impl(args, state))
}

fn remove_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.principal_to_user_id_map.get(&caller).copied() {
        let now = runtime_state.env.now();

        match runtime_state.data.chat.remove_reaction(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction,
            now,
        ) {
            AddRemoveReactionResult::Success => Success,
            AddRemoveReactionResult::NoChange | AddRemoveReactionResult::InvalidReaction => NoChange,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
            AddRemoveReactionResult::UserNotInGroup => CallerNotInGroup,
            AddRemoveReactionResult::NotAuthorized => NotAuthorized,
            AddRemoveReactionResult::UserSuspended => UserSuspended,
        }
    } else {
        CallerNotInGroup
    }
}
