use crate::guards::caller_is_owner;
use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::{DeleteMessageResult, DeleteUndeleteMessagesArgs};
use fire_and_forget_handler::FireAndForgetHandler;
use ic_cdk_macros::update;
use msgpack::serialize_then_unwrap;
use types::{CanisterId, EventIndex, MessageId};
use user_canister::c2c_delete_messages;
use user_canister::delete_messages::{Response::*, *};
use utils::consts::OPENCHAT_BOT_USER_ID;
use utils::time::MINUTE_IN_MS;

#[update(guard = "caller_is_owner")]
#[trace]
fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_messages_impl(args, state))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.suspended.value {
        return UserSuspended;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        let delete_message_results = chat.events.delete_messages(DeleteUndeleteMessagesArgs {
            caller: my_user_id,
            is_admin: true,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_ids: args.message_ids,
            now,
        });

        let deleted: Vec<_> = delete_message_results
            .into_iter()
            .filter_map(
                |(message_id, result)| {
                    if let DeleteMessageResult::Success(u) = result {
                        Some((message_id, u))
                    } else {
                        None
                    }
                },
            )
            .collect();

        if !deleted.is_empty() {
            let remove_deleted_message_content_at = now + (5 * MINUTE_IN_MS);
            for (message_id, _) in deleted.iter().copied() {
                runtime_state.data.timer_jobs.enqueue_job(
                    TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
                        chat_id: args.user_id.into(),
                        thread_root_message_index: None,
                        message_id,
                        delete_files: true,
                    })),
                    remove_deleted_message_content_at,
                    now,
                );
            }

            if args.user_id != OPENCHAT_BOT_USER_ID {
                let my_messages: Vec<_> = deleted
                    .iter()
                    .filter(|(_, u)| *u == my_user_id)
                    .map(|(id, _)| id)
                    .copied()
                    .collect();

                if !my_messages.is_empty() {
                    delete_on_recipients_canister(
                        args.user_id.into(),
                        my_messages,
                        &runtime_state.data.fire_and_forget_handler,
                    );
                }
            }
        }

        Success
    } else {
        ChatNotFound
    }
}

fn delete_on_recipients_canister(
    canister_id: CanisterId,
    message_ids: Vec<MessageId>,
    fire_and_forget_handler: &FireAndForgetHandler,
) {
    let args = c2c_delete_messages::Args {
        message_ids,
        correlation_id: 0,
    };
    fire_and_forget_handler.send(
        canister_id,
        "c2c_toggle_reaction_msgpack".to_string(),
        serialize_then_unwrap(&args),
    );
}
