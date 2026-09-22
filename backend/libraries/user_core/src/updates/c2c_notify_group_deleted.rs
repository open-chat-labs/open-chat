use crate::updates::c2c_local_user_index::BotMessage;
use crate::{User, openchat_bot};
use chat_events::ChatInternal;
use stable_memory_map::BaseKeyPrefix;
use types::{ChannelId, Chat, CommunityId, CommunityImportedInto, DeletedGroupInfoInternal, MultiUserChat, TimestampMillis};
use user_canister::mark_read::ChannelMessagesRead;

// What removing the group leaves the caller to do
pub struct GroupDeleted {
    pub bot_message: BotMessage,
    // The removed group's stable memory entries, to garbage collect
    pub garbage_collect: Vec<BaseKeyPrefix>,
    // If the group was imported into a community, the channel it became, for the caller to point
    // its own references to the group at (its message reminders)
    pub imported_into: Option<(CommunityId, ChannelId)>,
}

// Removes the deleted group from the user. If it was imported into a community, the user joins the
// community in its place, carrying over their read state and references to the group.
pub fn c2c_notify_group_deleted(
    user: &mut User,
    deleted_group: DeletedGroupInfoInternal,
    now: TimestampMillis,
) -> GroupDeleted {
    let chat_id = deleted_group.id;
    let was_favourite = user.favourite_chats.remove(&Chat::Group(chat_id), now);

    // Removing the group deletes how far the user has read each of its threads from stable memory,
    // so if the group has been imported into a community, move those entries to the channel first
    if let Some(imported_into) = &deleted_group.community_imported_into
        && let Some(group) = user.group_chats.get_mut(&chat_id)
    {
        group.messages_read.threads_read.move_entries(
            MultiUserChat::Group(chat_id),
            MultiUserChat::Channel(imported_into.community_id, imported_into.channel.channel_id),
        );
    }

    let (group_removed, garbage_collect) = match user.remove_group(chat_id, now) {
        Some((group, prefix)) => (Some(group), vec![prefix]),
        None => (None, Vec::new()),
    };

    let Some(CommunityImportedInto {
        community_name,
        community_id,
        local_user_index_canister_id,
        channel,
        other_default_channels,
    }) = deleted_group.community_imported_into
    else {
        return GroupDeleted {
            bot_message: BotMessage::text(openchat_bot::group_deleted_text(
                deleted_group.deleted_by,
                &deleted_group.group_name,
                deleted_group.public,
            )),
            garbage_collect,
            imported_into: None,
        };
    };

    // Point the user's replies to messages in the group at the channel instead
    user.direct_chats.migrate_replies(
        ChatInternal::Group(chat_id),
        ChatInternal::Channel(community_id, channel.channel_id),
        now,
    );

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

    GroupDeleted {
        bot_message: BotMessage::text(openchat_bot::group_imported_into_community_text(
            &deleted_group.group_name,
            deleted_group.public,
            &community_name,
            community_id,
            channel.channel_id,
        )),
        garbage_collect,
        imported_into: Some((community_id, channel.channel_id)),
    }
}
