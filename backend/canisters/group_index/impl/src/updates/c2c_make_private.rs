use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_make_private::{Response::*, *};
use types::ChatId;

#[update(msgpack = true)]
#[trace]
fn c2c_make_private(_args: Args) -> Response {
    mutate_state(c2c_make_private_impl)
}

fn c2c_make_private_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let chat_id = ChatId::from(caller);

    if let Some(group) = state.data.public_groups.delete(&chat_id) {
        state
            .data
            .public_group_and_community_names
            .remove(group.name(), chat_id.into());
        state.data.cached_hot_groups.remove(chat_id);
        state.data.private_groups.add(group.into());
        Success
    } else {
        ChatNotFound
    }
}
