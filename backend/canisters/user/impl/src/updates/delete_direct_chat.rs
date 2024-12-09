use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use stable_memory_map::{BaseKeyPrefix, ChatEventKeyPrefix};
use user_canister::delete_direct_chat::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn delete_direct_chat(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_direct_chat_impl(args, state))
}

fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if let Some(chat) = state.data.direct_chats.remove(args.user_id.into(), now) {
        if args.block_user {
            state.data.block_user(args.user_id, now);
        }

        state
            .data
            .stable_memory_keys_to_garbage_collect
            .push(BaseKeyPrefix::from(ChatEventKeyPrefix::new_from_direct_chat(
                args.user_id,
                None,
            )));

        for message_index in chat.events.thread_keys() {
            state.data.stable_memory_keys_to_garbage_collect.push(BaseKeyPrefix::from(
                ChatEventKeyPrefix::new_from_direct_chat(args.user_id, Some(message_index)),
            ));
        }

        crate::jobs::garbage_collect_stable_memory::start_job_if_required(state);
        Success
    } else {
        ChatNotFound
    }
}
