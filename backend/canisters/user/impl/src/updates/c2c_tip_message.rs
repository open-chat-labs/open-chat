use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::TipMessageResult;
use types::{EventIndex, UserId};
use user_canister::c2c_tip_message::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_tip_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_tip_message_impl(args, state))
}

fn c2c_tip_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id: UserId = state.env.caller().into();
    if let Some(chat) = state.data.direct_chats.get_mut(&user_id.into()) {
        let now = state.env.now();
        match chat.events.tip_message(
            user_id,
            EventIndex::default(),
            args.thread_root_message_index,
            args.message_id,
            args.transfer,
            now,
        ) {
            TipMessageResult::Success => Success,
            TipMessageResult::MessageNotFound => MessageNotFound,
            TipMessageResult::CannotTipSelf => unreachable!(),
        }
    } else {
        ChatNotFound
    }
}
