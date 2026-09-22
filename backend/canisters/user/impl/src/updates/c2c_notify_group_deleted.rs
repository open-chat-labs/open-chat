use crate::guards::caller_is_group_index;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Chat;
use user_canister::c2c_notify_group_deleted::*;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_notify_group_deleted(args: Args) -> Response {
    execute_update(|state| c2c_notify_group_deleted_impl(args, state))
}

fn c2c_notify_group_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let chat_id = args.deleted_group.id;
    let deleted =
        user_core::updates::c2c_notify_group_deleted::c2c_notify_group_deleted(&mut state.data.user, args.deleted_group, now);

    for prefix in deleted.garbage_collect {
        state.data.garbage_collect_now_or_later(prefix);
    }

    // Point the user's reminders of messages in the group at the channel instead
    if let Some((community_id, channel_id)) = deleted.imported_into {
        for (_, job) in state.data.timer_jobs.iter() {
            if let Some(TimerJob::MessageReminder(mr)) = job.borrow_mut().as_mut()
                && mr.chat == Chat::Group(chat_id)
            {
                mr.chat = Chat::Channel(community_id, channel_id);
            }
        }
    }

    openchat_bot::send_message(deleted.bot_message.content, deleted.bot_message.mentioned, false, state);
    Response::Success
}
