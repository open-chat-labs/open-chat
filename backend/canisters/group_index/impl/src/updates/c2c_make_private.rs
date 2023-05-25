use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_make_private::{Response::*, *};
use types::ChatId;

#[update_msgpack]
#[trace]
fn c2c_make_private(_args: Args) -> Response {
    mutate_state(c2c_make_private_impl)
}

fn c2c_make_private_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let chat_id = ChatId::from(caller);

    if let Some(group) = runtime_state.data.public_groups.delete(&chat_id) {
        runtime_state.data.cached_hot_groups.remove(chat_id);
        runtime_state.data.private_groups.add(group.into());
        Success
    } else {
        ChatNotFound
    }
}
