use crate::guards::caller_is_group_index;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatInternal;
use types::{Chat, CommunityImportedInto, MultiUserChat};
use user_canister::c2c_notify_group_deleted::*;
use user_canister::mark_read::ChannelMessagesRead;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_notify_group_deleted(args: Args) -> Response {
    mutate_state(|state| c2c_notify_group_deleted_impl(args, state))
}

// As in the User canister: the group is removed, and if it was imported into a community then the
// user is added to the community in its place, carrying over their read state and references to it
fn c2c_notify_group_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.local_user_index(args.user_id) else {
        return Response::Success;
    };
    let now = state.env.now();
    let chat_id = args.deleted_group.id;

    let was_favourite = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            let was_favourite = user.favourite_chats.remove(&Chat::Group(chat_id), now);

            // Removing the group deletes how far the user has read each of its threads from stable
            // memory, so if the group has been imported into a community, move those entries to the
            // channel first
            if let Some(imported_into) = &args.deleted_group.community_imported_into
                && let Some(group) = user.group_chats.get_mut(&chat_id)
            {
                group.messages_read.threads_read.move_entries(
                    MultiUserChat::Group(chat_id),
                    MultiUserChat::Channel(imported_into.community_id, imported_into.channel.channel_id),
                );
            }
            was_favourite
        })
        .unwrap_or_default();

    let group_removed = state.remove_group(user_index, chat_id, now);

    let Some(CommunityImportedInto {
        community_name,
        community_id,
        local_user_index_canister_id,
        channel,
        other_default_channels,
    }) = args.deleted_group.community_imported_into
    else {
        openchat_bot::send_group_deleted_message(
            user_index,
            args.deleted_group.deleted_by,
            args.deleted_group.group_name,
            args.deleted_group.public,
            state,
        );
        return Response::Success;
    };

    // Point the user's replies to, and reminders of, messages in the group at the channel instead
    state.data.users.with_user_mut(user_index, |user| {
        user.direct_chats.migrate_replies(
            ChatInternal::Group(chat_id),
            ChatInternal::Channel(community_id, channel.channel_id),
            now,
        );
    });
    for (_, job) in state.data.timer_jobs.iter() {
        if let Some(TimerJob::MessageReminder(reminder)) = job.borrow_mut().as_mut()
            && reminder.user_index == user_index
            && reminder.chat == Chat::Group(chat_id)
        {
            reminder.chat = Chat::Channel(community_id, channel.channel_id);
        }
    }

    openchat_bot::send_group_imported_into_community_message(
        user_index,
        args.deleted_group.group_name,
        args.deleted_group.public,
        community_name,
        community_id,
        channel.channel_id,
        state,
    );

    state.data.users.with_user_mut(user_index, |user| {
        let (community, newly_joined) = user.communities.join(community_id, local_user_index_canister_id, now);

        if let Some(group) = group_removed {
            community.import_group(channel.channel_id, group, now);
        } else {
            community.mark_read(
                vec![ChannelMessagesRead {
                    channel_id: channel.channel_id,
                    read_up_to: channel.latest_message_index,
                    threads: Vec::new(),
                    date_read_pinned: None,
                }],
                now,
            );
        }

        if newly_joined {
            community.mark_read(
                other_default_channels
                    .into_iter()
                    .map(|c| ChannelMessagesRead {
                        channel_id: c.channel_id,
                        read_up_to: c.latest_message_index,
                        threads: Vec::new(),
                        date_read_pinned: None,
                    })
                    .collect(),
                now,
            )
        }

        if was_favourite {
            user.favourite_chats.add(Chat::Channel(community_id, channel.channel_id), now);
        }
    });

    Response::Success
}
