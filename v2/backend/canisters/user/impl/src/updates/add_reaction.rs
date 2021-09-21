use crate::model::events::AddReactionResult;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use types::{CanisterId, MessageId};
use user_canister::add_reaction::{Response::*, *};
use user_canister::c2c_add_reaction;

#[update]
fn add_reaction(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| add_reaction_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn add_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = runtime_state.env.now();

        match chat.events.add_reaction(true, args.message_id, args.reaction.clone(), now) {
            AddReactionResult::Success => {
                ic_cdk::block_on(add_reaction_on_recipients_canister(
                    args.user_id.into(),
                    args.message_id,
                    args.reaction,
                ));
                Success
            }
            AddReactionResult::AlreadyAdded => Success,
            AddReactionResult::MessageNotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}

async fn add_reaction_on_recipients_canister(canister_id: CanisterId, message_id: MessageId, reaction: String) {
    let args = c2c_add_reaction::Args { message_id, reaction };
    let _ = user_canister_c2c_client::c2c_add_reaction(canister_id, &args).await;
}
