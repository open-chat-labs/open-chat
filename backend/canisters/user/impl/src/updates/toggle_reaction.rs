use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ToggleReactionResult;
use ic_cdk_macros::update;
use types::{CanisterId, MessageId, Reaction};
use user_canister::c2c_toggle_reaction;
use user_canister::toggle_reaction::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| toggle_reaction_impl(args, state))
    } else {
        InvalidReaction
    }
}

fn toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        match chat
            .events
            .toggle_reaction(my_user_id, None, args.message_id, args.reaction.clone(), now)
        {
            ToggleReactionResult::Added(e) => {
                ic_cdk::spawn(toggle_reaction_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.reaction,
                    true,
                    args.username,
                ));
                Added(e)
            }
            ToggleReactionResult::Removed(e) => {
                ic_cdk::spawn(toggle_reaction_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.reaction,
                    false,
                    args.username,
                ));
                Removed(e)
            }
            ToggleReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}

async fn toggle_reaction_on_recipients_canister(
    canister_id: CanisterId,
    message_id: MessageId,
    reaction: Reaction,
    added: bool,
    username: String,
) {
    let args = c2c_toggle_reaction::Args {
        message_id,
        reaction,
        added,
        username,
    };
    let _ = user_canister_c2c_client::c2c_toggle_reaction(canister_id, &args).await;
}
