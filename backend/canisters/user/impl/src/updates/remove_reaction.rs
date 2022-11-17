use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::AddRemoveReactionResult;
use ic_cdk_macros::update;
use types::{CanisterId, MessageId, Reaction};
use user_canister::c2c_toggle_reaction;
use user_canister::remove_reaction::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn remove_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_reaction_impl(args, state))
}

fn remove_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.frozen.value {
        return UserFrozen;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        match chat.events.remove_reaction(
            my_user_id,
            None,
            args.message_id,
            args.reaction.clone(),
            args.correlation_id,
            now,
        ) {
            AddRemoveReactionResult::Success(e) => {
                ic_cdk::spawn(remove_reaction_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.reaction,
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

async fn remove_reaction_on_recipients_canister(
    canister_id: CanisterId,
    message_id: MessageId,
    reaction: Reaction,
    correlation_id: u64,
) {
    let args = c2c_toggle_reaction::Args {
        message_id,
        reaction,
        added: false,
        username: "".to_string(),
        correlation_id,
    };
    let _ = user_canister_c2c_client::c2c_toggle_reaction(canister_id, &args).await;
}
