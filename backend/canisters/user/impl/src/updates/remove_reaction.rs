use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{AddRemoveReactionArgs, AddRemoveReactionResult};
use ic_cdk_macros::update;
use types::{CanisterId, EventIndex, MessageId, Reaction};
use user_canister::c2c_toggle_reaction;
use user_canister::remove_reaction::{Response::*, *};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner")]
#[trace]
fn remove_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_reaction_impl(args, state))
}

fn remove_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.suspended.value {
        return UserSuspended;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

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
                    ic_cdk::spawn(remove_reaction_on_recipients_canister(
                        args.user_id.into(),
                        args.message_id,
                        args.reaction,
                        args.correlation_id,
                    ));
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
