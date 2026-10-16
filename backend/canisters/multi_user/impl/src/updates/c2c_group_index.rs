use crate::guards::caller_is_group_index;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::GroupIndexEvent;
use multi_user_canister::c2c_group_index::*;
use types::{Chat, DeletedCommunityInfo, DeletedGroupInfoInternal};

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_group_index(args: Args) -> Response {
    execute_update(|state| c2c_group_index_impl(args, state))
}

// Applies the events to the users they are for, in order
fn c2c_group_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    for event in args.events {
        if !state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            continue;
        }
        let (user_id, event) = event.value;
        // Events for a user who isn't in this canister can never be applied, so are dropped rather
        // than failing the batch, which the GroupIndex would otherwise retry
        let Some(user_index) = state.index_of_local_user(user_id) else {
            continue;
        };
        match event {
            GroupIndexEvent::GroupDeleted(deleted_group) => group_deleted(user_index, *deleted_group, state),
            GroupIndexEvent::CommunityDeleted(deleted_community) => community_deleted(user_index, *deleted_community, state),
        }
    }
    Response::Success
}

// Removes the deleted group from the user at `user_index`, telling them via the OpenChat bot. If the
// group was imported into a community, the user joins the community in its place.
pub(crate) fn group_deleted(user_index: u16, deleted_group: DeletedGroupInfoInternal, state: &mut RuntimeState) {
    let now = state.env.now();
    let chat_id = deleted_group.id;
    let Some(deleted) = state.data.users.with_user_mut(user_index, |user| {
        user_core::updates::c2c_notify_group_deleted::c2c_notify_group_deleted(user, deleted_group, now)
    }) else {
        return;
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
}

// Removes the deleted community from the user at `user_index`, telling them via the OpenChat bot
pub(crate) fn community_deleted(user_index: u16, deleted_community: DeletedCommunityInfo, state: &mut RuntimeState) {
    let now = state.env.now();

    state.remove_community(user_index, deleted_community.id, now);

    openchat_bot::send_community_deleted_message(
        user_index,
        deleted_community.deleted_by,
        deleted_community.name,
        deleted_community.public,
        state,
    );
}
