use crate::guards::caller_is_owner;
use crate::updates::mark_read_v2::mark_read_impl;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::mark_read::Args;
use user_canister::mark_read_v2::{self, ChatMessagesRead, Response, ThreadRead};

#[update(guard = "caller_is_owner")]
#[trace]
fn mark_read(args: Args) -> Response {
    run_regular_jobs();

    let args_v2 = mark_read_v2::Args {
        messages_read: args
            .messages_read
            .into_iter()
            .map(|m| ChatMessagesRead {
                chat_id: m.chat_id,
                read_up_to: m.message_ranges.into_iter().last().map(|r| r.to),
                threads: m
                    .threads
                    .into_iter()
                    .map(|t| ThreadRead {
                        root_message_index: t.root_message_index,
                        read_up_to: t.read_up_to,
                    })
                    .collect(),
            })
            .collect(),
    };

    mutate_state(|state| mark_read_impl(args_v2, state))
}
