use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{AddRemoveReactionArgs, AddRemoveReactionResult};
use ic_cdk_macros::update;
use types::EventIndex;
use user_canister::remove_reaction::{Response::*, *};
use user_canister::{c2c_toggle_reaction, UserCanisterEvent};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner")]
#[trace]
fn remove_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_reaction_impl(args, state))
}

fn remove_reaction_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();

        match chat.events.remove_reaction(AddRemoveReactionArgs {
            user_id: my_user_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_id: args.message_id,
            reaction: args.reaction.clone(),
            now,
        }) {
            AddRemoveReactionResult::Success => {
                if args.user_id != OPENCHAT_BOT_USER_ID {
                    state.push_user_canister_event(
                        args.user_id.into(),
                        UserCanisterEvent::ToggleReaction(Box::new(c2c_toggle_reaction::Args {
                            message_id: args.message_id,
                            reaction: args.reaction,
                            added: false,
                            username: "".to_string(),
                            display_name: None,
                            user_avatar_id: None,
                            correlation_id: 0,
                        })),
                    );
                }
                Success
            }
            AddRemoveReactionResult::NoChange => NoChange,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
