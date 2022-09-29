use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::AddRemoveReactionResult;
use ic_cdk_macros::update;
use types::{CanisterId, MessageId, Reaction};
use user_canister::add_reaction::{Response::*, *};
use user_canister::c2c_toggle_reaction;

#[update(guard = "caller_is_owner")]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| add_reaction_impl(args, state))
    } else {
        InvalidReaction
    }
}

fn add_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        match chat
            .events
            .add_reaction(my_user_id, None, args.message_id, args.reaction.clone(), args.correlation_id, now)
        {
            AddRemoveReactionResult::Success(e) => {
                ic_cdk::spawn(add_reaction_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.reaction,
                    args.username,
                    args.correlation_id,
                ));
                Success(e)
            }
            AddRemoveReactionResult::NoChange => NoChange,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}

async fn add_reaction_on_recipients_canister(
    canister_id: CanisterId,
    message_id: MessageId,
    reaction: Reaction,
    username: String,
    correlation_id: u64,
) {
    let args = c2c_toggle_reaction::Args {
        message_id,
        reaction,
        added: true,
        username,
        correlation_id,
    };
    let _ = user_canister_c2c_client::c2c_toggle_reaction(canister_id, &args).await;
}
