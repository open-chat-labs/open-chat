//! Applying another user's events to the recipient's copy of their direct chat, and which senders
//! a caller may send them for. Each function is given the chat (or user) and returns what the
//! canister then has to do: enqueue or cancel hard-delete jobs, and notify or reward the recipient.

use crate::User;
use chat_events::{
    AddRemoveReactionArgs, DeleteUndeleteMessagesArgs, EditMessageArgs, NullEventPusher, Reader, TipMessageArgs,
};
use direct_chat::DirectChat;
use ledger_utils::format_crypto_amount_with_symbol;
use local_user_index_canister::is_user_or_multi_user_canister::Response as CanisterKind;
use types::{
    CanisterId, Chat, DirectChatUserNotificationPayload, DirectMessageTipped, DirectReactionAddedNotification, EventIndex,
    MessageContentInitial, MessageId, MessageIndex, OCResult, P2PSwapStatus, TimestampMillis, UserId, UserType,
    VideoCallPresence,
};
use user_canister::{
    DeleteUndeleteMessagesArgs as C2CDeleteUndeleteMessagesArgs, EditMessageArgs as C2CEditMessageArgs, MessageActivity,
    MessageActivityEvent, P2PSwapStatusChange, SetEventsTtl, TipMessageArgs as C2CTipMessageArgs, ToggleReactionArgs,
};
use utils::migrated_user_ids::MigratedUserIds;

// Whether a sender is one a canister of this kind can act for: a User canister acts only for its
// own user, whose id is the canister's id, and a MultiUser canister only for the users it holds,
// whose ids carry an index, never as its own canister id
pub fn can_act_for(kind: CanisterKind, sender: UserId, caller: CanisterId) -> bool {
    match kind {
        CanisterKind::UserCanister => sender == UserId::from(caller),
        CanisterKind::MultiUserCanister => sender.index() != 0 && sender.canister_id() == caller,
        CanisterKind::Neither => false,
    }
}

pub fn edit_message(
    chat: &mut DirectChat,
    sender: UserId,
    args: C2CEditMessageArgs,
    now: TimestampMillis,
    migrated_user_ids: &MigratedUserIds,
) {
    let Ok(thread_root_message_index) = chat.thread_root_message_index(args.thread_root_message_id) else {
        return;
    };
    let _ = chat.edit_message::<NullEventPusher>(
        EditMessageArgs {
            sender,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index,
            message_id: args.message_id,
            content: MessageContentInitial::from(args.content).into(),
            block_level_markdown: args.block_level_markdown,
            og_previews: args.og_previews,
            finalise_bot_message: false,
            now,
        },
        migrated_user_ids,
        None,
    );
}

// Deletes the messages the sender may delete, returning the thread they are in and the ids of those
// deleted, whose content the caller hard deletes later
pub fn delete_messages(
    chat: &mut DirectChat,
    sender: UserId,
    args: C2CDeleteUndeleteMessagesArgs,
    now: TimestampMillis,
    migrated_user_ids: &MigratedUserIds,
) -> Option<(Option<MessageIndex>, Vec<MessageId>)> {
    let thread_root_message_index = chat.thread_root_message_index(args.thread_root_message_id).ok()?;
    let deleted = successful(chat.delete_messages(
        DeleteUndeleteMessagesArgs {
            caller: sender,
            is_admin: false,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index,
            message_ids: args.message_ids,
            now,
        },
        migrated_user_ids,
    ));
    Some((thread_root_message_index, deleted))
}

// Undeletes the messages the sender may undelete, returning the thread they are in and the ids of
// those undeleted, whose pending hard deletes the caller cancels
pub fn undelete_messages(
    chat: &mut DirectChat,
    sender: UserId,
    args: C2CDeleteUndeleteMessagesArgs,
    now: TimestampMillis,
    migrated_user_ids: &MigratedUserIds,
) -> Option<(Option<MessageIndex>, Vec<MessageId>)> {
    let thread_root_message_index = chat.thread_root_message_index(args.thread_root_message_id).ok()?;
    let undeleted = successful(chat.undelete_messages(
        DeleteUndeleteMessagesArgs {
            caller: sender,
            is_admin: false,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index,
            message_ids: args.message_ids,
            now,
        },
        migrated_user_ids,
    ));
    Some((thread_root_message_index, undeleted))
}

fn successful<T>(results: Vec<(MessageId, OCResult<T>)>) -> Vec<MessageId> {
    results
        .into_iter()
        .filter_map(|(message_id, result)| result.is_ok().then_some(message_id))
        .collect()
}

// What a reaction added to one of the recipient's own messages earns them from the caller: a
// notification, an entry in their message activity feed, and the `HadMessageReactedTo`
// achievement. The caller skips the notification if the recipient is suspended.
pub struct ReactionAdded {
    // None if the sender gave no username or the recipient has muted the chat
    pub notification: Option<DirectChatUserNotificationPayload>,
    pub activity: MessageActivityEvent,
}

// Adds or removes the sender's reaction. Returns None if the reaction was removed, was to the
// sender's own message, or couldn't be applied, since none of those give the recipient anything.
pub fn toggle_reaction(
    chat: &mut DirectChat,
    sender: UserId,
    args: ToggleReactionArgs,
    now: TimestampMillis,
    migrated_user_ids: &MigratedUserIds,
) -> Option<ReactionAdded> {
    if !args.reaction.is_valid() {
        return None;
    }
    let thread_root_message_index = chat.thread_root_message_index(args.thread_root_message_id).ok()?;
    let add_remove_reaction_args = AddRemoveReactionArgs {
        user_id: sender,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index,
        message_id: args.message_id,
        reaction: args.reaction.clone(),
        now,
    };
    if !args.added {
        let _ = chat.remove_reaction(add_remove_reaction_args, migrated_user_ids);
        return None;
    }

    let result = chat
        .add_reaction::<NullEventPusher>(add_remove_reaction_args, migrated_user_ids, None)
        .ok()?;
    let message = result.value;
    // They may be reacting to their own message; in that case we should not generate any activity
    // for the other user (push notification, activity-feed event, or achievement progress).
    if migrated_user_ids.is_same_user(message.sender, sender) {
        return None;
    }

    let notification = (!args.username.is_empty() && !chat.notifications_muted.value).then_some(
        DirectChatUserNotificationPayload::DirectReactionAdded(DirectReactionAddedNotification {
            them: chat.them,
            thread_root_message_index,
            message_index: message.message_index,
            message_event_index: result.event_index,
            username: args.username,
            display_name: args.display_name,
            reaction: args.reaction,
            user_avatar_id: args.user_avatar_id,
        }),
    );
    let activity = MessageActivityEvent {
        chat: Chat::Direct(sender.into()),
        thread_root_message_index,
        message_index: message.message_index,
        message_id: message.message_id,
        event_index: result.event_index,
        activity: MessageActivity::Reaction,
        timestamp: now,
        user_id: Some(sender),
    };
    Some(ReactionAdded { notification, activity })
}

// What a tip on one of the recipient's messages earns them from the caller: a notification and an
// entry in their message activity feed if the message was found, and the `HadMessageTipped`
// achievement either way
pub struct TipReceived {
    pub notification: Option<DirectChatUserNotificationPayload>,
    pub activity: Option<MessageActivityEvent>,
}

// Records the sender's tip on the recipient's copy of the message. Returns None if it couldn't be
// applied, in which case the recipient gets nothing.
pub fn tip_message(
    chat: &mut DirectChat,
    sender: UserId,
    my_user_id: UserId,
    args: C2CTipMessageArgs,
    now: TimestampMillis,
    migrated_user_ids: &MigratedUserIds,
) -> Option<TipReceived> {
    let thread_root_message_index = chat.thread_root_message_index(args.thread_root_message_id).ok()?;
    chat.tip_message::<NullEventPusher>(
        TipMessageArgs {
            user_id: sender,
            recipient: my_user_id,
            thread_root_message_index,
            message_id: args.message_id,
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            now,
        },
        migrated_user_ids,
        None,
    )
    .ok()?;

    let Some(message_event) = chat
        .events()
        .main_events_reader()
        .message_event_internal(args.message_id.into())
    else {
        return Some(TipReceived {
            notification: None,
            activity: None,
        });
    };
    let tip = format_crypto_amount_with_symbol(args.amount, args.decimals, &args.token_symbol);
    let notification = DirectChatUserNotificationPayload::DirectMessageTipped(DirectMessageTipped {
        them: sender,
        thread_root_message_index,
        message_index: message_event.event.message_index,
        message_event_index: message_event.index,
        username: args.username,
        display_name: args.display_name,
        tip,
        user_avatar_id: args.user_avatar_id,
    });
    let activity = MessageActivityEvent {
        chat: Chat::Direct(sender.into()),
        thread_root_message_index,
        message_index: message_event.event.message_index,
        message_id: message_event.event.message_id,
        event_index: message_event.index,
        activity: MessageActivity::Tip,
        timestamp: now,
        user_id: Some(sender),
    };
    Some(TipReceived {
        notification: Some(notification),
        activity: Some(activity),
    })
}

// Applies the sender's change to the status of a P2P swap between them, adding the swap's
// completion to the recipient's message activity feed
pub fn p2p_swap_change_status(user: &mut User, sender: UserId, args: P2PSwapStatusChange, now: TimestampMillis) {
    let Some(chat) = user.direct_chats.get_mut(&sender.into()) else {
        return;
    };
    let completed = matches!(args.status, P2PSwapStatus::Completed(_));

    if chat.set_p2p_swap_status(None, args.message_id, args.status, now).is_ok()
        && completed
        && let Some(message_event) = chat
            .events()
            .main_events_reader()
            .message_event_internal(args.message_id.into())
        && let Ok(thread_root_message_index) = chat.thread_root_message_index(args.thread_root_message_id)
    {
        let activity = MessageActivityEvent {
            chat: Chat::Direct(sender.into()),
            thread_root_message_index,
            message_index: message_event.event.message_index,
            message_id: message_event.event.message_id,
            event_index: message_event.index,
            activity: MessageActivity::P2PSwapAccepted,
            timestamp: now,
            user_id: Some(sender),
        };
        user.push_message_activity(activity, now);
    }
}

// Records the sender joining the call in the recipient's copy of the chat
pub fn join_video_call(chat: &mut DirectChat, sender: UserId, message_id: MessageId, now: TimestampMillis) {
    let _ = chat.set_video_call_presence(sender, message_id, VideoCallPresence::Default, now);
}

// Applies the sender's change to the chat's message TTL, creating the chat if the recipient doesn't
// have it yet. The change is applied if it is the latest; two changes made at the same time are
// settled in favour of whichever user's id has the lower bytes, so that both copies agree.
pub fn set_events_ttl(
    user: &mut User,
    my_user_id: UserId,
    sender: UserId,
    args: SetEventsTtl,
    anonymized_chat_id: impl FnOnce() -> u128,
    now: TimestampMillis,
) {
    let chat = user
        .direct_chats
        .get_or_create(my_user_id, sender, UserType::User, anonymized_chat_id, now);
    let events_ttl = chat.events().get_events_time_to_live();
    // Changes are compared by when they were made, not by when this copy was updated
    let last_changed_at = chat.events_ttl_last_changed();
    // Until the TTL is set it is `None`, timestamped with when the chat was created, which may be
    // after the sender set it, eg. if the chat was created by an earlier event from the sender
    // which was delivered in the same batch as this one. The recipient hasn't set it, so the
    // sender's change is applied. A TTL the recipient set when creating the chat has the same
    // timestamp but isn't `None`, since setting the TTL to the value it already has does nothing.
    let never_set =
        chat.events_ttl_changed_at().is_none() && events_ttl.value.is_none() && events_ttl.timestamp == chat.date_created();
    if never_set
        || last_changed_at < args.timestamp
        || (last_changed_at == args.timestamp && sender.as_slice() < my_user_id.as_slice())
    {
        chat.apply_their_events_time_to_live(args.events_ttl, args.timestamp, now);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    fn user() -> User {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
        User::new(Principal::from_slice(&[9]), "username".to_string(), None, 100)
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn events_ttl(user: &User, them: UserId) -> Option<u64> {
        user.direct_chats
            .get(&them.into())
            .unwrap()
            .events()
            .get_events_time_to_live()
            .value
    }

    // The user `me` changes the TTL at `now`, creating the chat if they don't have it, returning
    // the time the change is given, which is what is sent to the other user
    fn change(user: &mut User, me: UserId, them: UserId, value: u64, now: TimestampMillis) -> TimestampMillis {
        user.direct_chats
            .get_or_create(me, them, UserType::User, || 1, now)
            .set_events_time_to_live(me, Some(value), now)
            .unwrap()
    }

    // The user `me` receives the other user's change, which they made at `timestamp`
    fn receive(user: &mut User, me: UserId, sender: UserId, value: u64, timestamp: TimestampMillis, now: TimestampMillis) {
        set_events_ttl(
            user,
            me,
            sender,
            SetEventsTtl {
                events_ttl: Some(value),
                timestamp,
            },
            || 1,
            now,
        );
    }

    #[test]
    fn change_is_applied_to_a_chat_created_after_it_was_made() {
        // The sender's earlier message created the chat after they changed the TTL, as happens
        // when their events are batched
        let (me, sender) = (user_id(1), user_id(2));
        let mut user = user();
        user.direct_chats.get_or_create(me, sender, UserType::User, || 1, 100);

        receive(&mut user, me, sender, 1000, 50, 100);

        assert_eq!(events_ttl(&user, sender), Some(1000));
    }

    #[test]
    fn own_change_made_when_the_chat_was_created_is_kept_over_an_older_one() {
        // `update_chat_settings` creates the chat and sets its TTL at the same time
        let (me, sender) = (user_id(1), user_id(2));
        let mut user = user();
        change(&mut user, me, sender, 2000, 100);

        receive(&mut user, me, sender, 1000, 50, 110);

        assert_eq!(events_ttl(&user, sender), Some(2000));
    }

    #[test]
    fn change_older_than_the_recipients_own_is_ignored() {
        let (me, sender) = (user_id(1), user_id(2));
        let mut user = user();
        user.direct_chats.get_or_create(me, sender, UserType::User, || 1, 100);
        change(&mut user, me, sender, 2000, 200);

        receive(&mut user, me, sender, 1000, 150, 300);

        assert_eq!(events_ttl(&user, sender), Some(2000));
    }

    #[test]
    fn change_newer_than_the_recipients_own_is_applied() {
        let (me, sender) = (user_id(1), user_id(2));
        let mut user = user();
        user.direct_chats.get_or_create(me, sender, UserType::User, || 1, 100);
        change(&mut user, me, sender, 2000, 200);

        receive(&mut user, me, sender, 1000, 250, 300);

        assert_eq!(events_ttl(&user, sender), Some(1000));
    }

    #[test]
    fn copies_converge_when_both_users_set_the_ttl_on_a_new_chat() {
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());

        let a_changed_at = change(&mut user_a, a, b, 1000, 50);
        let b_changed_at = change(&mut user_b, b, a, 2000, 100);
        receive(&mut user_a, a, b, 2000, b_changed_at, 110);
        receive(&mut user_b, b, a, 1000, a_changed_at, 110);

        assert_eq!(events_ttl(&user_a, b), Some(2000));
        assert_eq!(events_ttl(&user_b, a), Some(2000));
    }

    #[test]
    fn changes_delivered_together_are_compared_by_when_they_were_made() {
        // The sender changed the TTL twice before either change was delivered. Once the first is
        // applied, the second must be compared with when the first was made, not delivered.
        let (me, sender) = (user_id(1), user_id(2));
        let mut user = user();
        user.direct_chats.get_or_create(me, sender, UserType::User, || 1, 0);

        receive(&mut user, me, sender, 1000, 10, 100);
        receive(&mut user, me, sender, 2000, 20, 100);

        assert_eq!(events_ttl(&user, sender), Some(2000));
    }

    #[test]
    fn copies_converge_when_one_user_changes_the_ttl_twice_before_the_other_hears() {
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());

        let b_changed_at = change(&mut user_b, b, a, 500, 5);
        receive(&mut user_a, a, b, 500, b_changed_at, 7);
        let first = change(&mut user_a, a, b, 1000, 10);
        let second = change(&mut user_a, a, b, 2000, 20);

        // B receives both of A's changes together
        receive(&mut user_b, b, a, 1000, first, 100);
        receive(&mut user_b, b, a, 2000, second, 100);

        assert_eq!(events_ttl(&user_a, b), Some(2000));
        assert_eq!(events_ttl(&user_b, a), Some(2000));
    }

    #[test]
    fn change_which_leaves_the_ttl_as_it_was_still_counts_as_the_latest() {
        // B changed the TTL to 2000, then back to 1000, which A already had. The second change
        // arrives first, then the first arrives late, and must not be applied.
        let (a, b) = (user_id(1), user_id(2));
        let mut user_a = user();
        change(&mut user_a, a, b, 1000, 10);

        receive(&mut user_a, a, b, 1000, 20, 30);
        receive(&mut user_a, a, b, 2000, 15, 31);

        assert_eq!(events_ttl(&user_a, b), Some(1000));
    }

    #[test]
    fn changes_made_in_the_same_millisecond_are_ordered() {
        // B's id sorts after A's, so the tie-break on user ids wouldn't favour B's second change
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());
        user_a.direct_chats.get_or_create(a, b, UserType::User, || 1, 0);

        let first = change(&mut user_b, b, a, 1000, 100);
        let second = change(&mut user_b, b, a, 2000, 100);
        assert!(second > first);
        receive(&mut user_a, a, b, 1000, first, 110);
        receive(&mut user_a, a, b, 2000, second, 110);

        assert_eq!(events_ttl(&user_a, b), Some(2000));
        assert_eq!(events_ttl(&user_b, a), Some(2000));
    }

    #[test]
    fn change_made_after_one_from_a_clock_which_is_ahead_is_ordered_after_it() {
        // A receives B's change, made at 20 by B's clock, while A's clock is at 12, then changes
        // the TTL at 13 by A's clock
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());
        user_a.direct_chats.get_or_create(a, b, UserType::User, || 1, 0);

        let b_changed_at = change(&mut user_b, b, a, 1000, 20);
        receive(&mut user_a, a, b, 1000, b_changed_at, 12);
        let a_changed_at = change(&mut user_a, a, b, 2000, 13);
        receive(&mut user_b, b, a, 2000, a_changed_at, 30);

        assert_eq!(events_ttl(&user_a, b), Some(2000));
        assert_eq!(events_ttl(&user_b, a), Some(2000));
    }
}
