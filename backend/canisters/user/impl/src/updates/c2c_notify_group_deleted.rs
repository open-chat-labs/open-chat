use crate::guards::caller_is_group_index;
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, openchat_bot, run_regular_jobs, Data, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatInternal;
use types::{ChannelId, Chat, ChatId, CommunityId, CommunityImportedInto, TimestampMillis};
use user_canister::c2c_notify_group_deleted::{Response::*, *};
use user_canister::mark_read::ChannelMessagesRead;

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
fn c2c_notify_group_deleted(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_group_deleted_impl(args, state))
}

fn c2c_notify_group_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let chat_id = args.deleted_group.id;
    let group_removed = state.data.group_chats.remove(chat_id, now);

    if let Some(cached_groups) = &mut state.data.cached_group_summaries {
        cached_groups.remove_group(&chat_id);
    }

    let was_favourite = state.data.favourite_chats.remove(&Chat::Group(chat_id), now);

    if let Some(CommunityImportedInto {
        community_name,
        community_id,
        channel,
        other_default_channels,
    }) = args.deleted_group.community_imported_into
    {
        migrate_group_references_to_channel_references(chat_id, community_id, channel.channel_id, now, &mut state.data);

        openchat_bot::send_group_imported_into_community_message(
            args.deleted_group.group_name,
            args.deleted_group.public,
            community_name,
            community_id,
            channel.channel_id,
            state,
        );

        let (community, newly_joined) = state.data.communities.join(community_id, now);

        if let Some(group) = group_removed {
            community.import_group(channel.channel_id, group);
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
            state
                .data
                .favourite_chats
                .add(Chat::Channel(community_id, channel.channel_id), now);
        }
    } else {
        openchat_bot::send_group_deleted_message(
            args.deleted_group.deleted_by,
            args.deleted_group.group_name,
            args.deleted_group.public,
            state,
        );
    }
    Success
}

fn migrate_group_references_to_channel_references(
    group_id: ChatId,
    community_id: CommunityId,
    channel_id: ChannelId,
    now: TimestampMillis,
    data: &mut Data,
) {
    data.direct_chats.migrate_replies(
        ChatInternal::Group(group_id),
        ChatInternal::Channel(community_id, channel_id),
        now,
    );

    for (_, job) in data.timer_jobs.jobs.values_mut() {
        if let Some(TimerJob::MessageReminder(mr)) = job.borrow_mut().as_mut() {
            if mr.chat == Chat::Group(group_id) {
                mr.chat = Chat::Channel(community_id, channel_id);
            }
        }
    }
}
