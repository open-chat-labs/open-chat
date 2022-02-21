use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, UserId};
use user_canister::c2c_mark_read::{Response::*, *};
use utils::range_set::insert_ranges;

#[update]
#[trace]
fn c2c_mark_read(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_mark_read_impl(args, state))
}

fn c2c_mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let their_user_id: UserId = runtime_state.env.caller().into();
    let chat_id = ChatId::from(their_user_id);
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        let now = runtime_state.env.now();
        let added = insert_ranges(&mut chat.read_by_them.value, &args.message_ranges);
        if !added.is_empty() {
            chat.read_by_them.timestamp = now;
            Success
        } else {
            SuccessNoChange
        }
    } else {
        ChatNotFound
    }
}
