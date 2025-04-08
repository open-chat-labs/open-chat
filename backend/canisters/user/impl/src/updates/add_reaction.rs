use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::AddRemoveReactionArgs;
use oc_error_codes::OCErrorCode;
use types::{Achievement, EventIndex};
use user_canister::add_reaction::{Response::*, *};
use user_canister::{ToggleReactionArgs, UserCanisterEvent};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| add_reaction_impl(args, state))
    } else {
        Error(OCErrorCode::InvalidReaction.into())
    }
}

fn add_reaction_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return Error(OCErrorCode::InitiatorSuspended.into());
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();

        if let Err(error) = chat.events.add_reaction(
            AddRemoveReactionArgs {
                user_id: my_user_id,
                min_visible_event_index: EventIndex::default(),
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                reaction: args.reaction.clone(),
                now,
            },
            Some(&mut state.data.event_store_client),
        ) {
            Error(error)
        } else {
            let thread_root_message_id = args.thread_root_message_index.map(|i| chat.main_message_index_to_id(i));

            state.push_user_canister_event(
                args.user_id.into(),
                UserCanisterEvent::ToggleReaction(Box::new(ToggleReactionArgs {
                    thread_root_message_id,
                    message_id: args.message_id,
                    reaction: args.reaction,
                    added: true,
                    username: state.data.username.value.clone(),
                    display_name: state.data.display_name.value.clone(),
                    user_avatar_id: state.data.avatar.value.as_ref().map(|d| d.id),
                })),
            );

            state.award_achievement_and_notify(Achievement::ReactedToMessage, now);

            Success
        }
    } else {
        Error(OCErrorCode::ChatNotFound.into())
    }
}
