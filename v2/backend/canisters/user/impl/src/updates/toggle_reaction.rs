use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::ToggleReactionResult;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{CanisterId, MessageId, Reaction};
use user_canister::c2c_toggle_reaction;
use user_canister::toggle_reaction::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        RUNTIME_STATE.with(|state| toggle_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
    } else {
        InvalidReaction
    }
}

fn toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        match chat
            .events
            .toggle_reaction(my_user_id, args.message_id, args.reaction.clone(), now)
        {
            ToggleReactionResult::Added(e) => {
                ic_cdk::block_on(toggle_reaction_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.reaction,
                    true,
                ));
                Added(e)
            }
            ToggleReactionResult::Removed(e) => {
                ic_cdk::block_on(toggle_reaction_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.reaction,
                    false,
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
) {
    let args = c2c_toggle_reaction::Args {
        message_id,
        reaction,
        added,
    };
    let _ = user_canister_c2c_client::c2c_toggle_reaction(canister_id, &args).await;
}
