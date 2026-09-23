use crate::guards::caller_is_group_index;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Chat;
use user_canister::c2c_notify_group_deleted::*;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_notify_group_deleted(args: Args) -> Response {
    mutate_state(|state| c2c_notify_group_deleted_impl(args, state))
}

fn c2c_notify_group_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.index_of_local_user(args.user_id) else {
        return Response::Success;
    };
    let now = state.env.now();
    let chat_id = args.deleted_group.id;
    let Some(deleted) = state.data.users.with_user_mut(user_index, |user| {
        user_core::updates::c2c_notify_group_deleted::c2c_notify_group_deleted(user, args.deleted_group, now)
    }) else {
        return Response::Success;
    };

    state.garbage_collect_removed_chat_keys(user_index, deleted.garbage_collect);

    // Point the user's reminders of messages in the group at the channel instead
    if let Some((community_id, channel_id)) = deleted.imported_into {
        for (_, job) in state.data.timer_jobs.iter() {
            if let Some(TimerJob::MessageReminder(reminder)) = job.borrow_mut().as_mut()
                && reminder.user_index == user_index
                && reminder.chat == Chat::Group(chat_id)
            {
                reminder.chat = Chat::Channel(community_id, channel_id);
            }
        }
    }

    openchat_bot::send_message(
        user_index,
        deleted.bot_message.content,
        deleted.bot_message.mentioned,
        false,
        state,
    );
    Response::Success
}
