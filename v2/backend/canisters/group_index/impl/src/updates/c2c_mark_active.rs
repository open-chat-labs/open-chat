use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_mark_active::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;
use types::ChatId;

#[update]
#[instrument(level = "trace", skip_all)]
fn c2c_mark_active(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_mark_active_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_mark_active_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let chat_id = ChatId::from(runtime_state.env.caller());
    let now = runtime_state.env.now();

    if let Some(g) = runtime_state.data.private_groups.get_mut(&chat_id) {
        g.mark_active(now + args.duration);
    } else if let Some(g) = runtime_state.data.public_groups.get_mut(&chat_id) {
        g.mark_active(now + args.duration);
    } else {
        return ChatNotFound;
    }
    Success
}
