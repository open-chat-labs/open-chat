//! Applying another user's events to the recipient's copy of their direct chat, and which senders
//! a caller may send them for. The OpenChat bot's messages are received the same way. Each function
//! is given the chat (or user) and returns what the canister then has to do: enqueue or cancel
//! hard-delete jobs, and notify or reward the recipient.

use crate::User;
use chat_events::{
    AddRemoveReactionArgs, DeleteUndeleteMessagesArgs, EditMessageArgs, EventPusher, MessageContentInternal, NullEventPusher,
    PushMessageArgs, Reader, ReplyContextInternal, TipMessageArgs,
};
use direct_chat::{DirectChat, EventsTtlChange, EventsTtlLatestChange};
use ledger_utils::format_crypto_amount_with_symbol;
use local_user_index_canister::is_user_or_multi_user_canister::Response as CanisterKind;
use types::{
    CanisterId, Chat, DirectChatUserNotificationPayload, DirectMessageNotification, DirectMessageTipped,
    DirectReactionAddedNotification, EventIndex, EventWrapper, Message, MessageContent, MessageContentInitial, MessageId,
    MessageIndex, OCResult, OgPreview, P2PSwapStatus, TimestampMillis, UserId, UserType, VideoCallPresence,
};
use user_canister::{
    C2CReplyContext, DeleteUndeleteMessagesArgs as C2CDeleteUndeleteMessagesArgs, EditMessageArgs as C2CEditMessageArgs,
    MessageActivity, MessageActivityEvent, P2PSwapStatusChange, SetEventsTtl, TipMessageArgs as C2CTipMessageArgs,
    ToggleReactionArgs,
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

// A message from another user, or from the OpenChat bot, for the recipient's copy of their direct
// chat with its sender
pub struct ReceiveMessageArgs {
    pub sender: UserId,
    pub sender_user_type: UserType,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub sender_avatar_id: Option<u128>,
    // The thread is given by the id of its root message, since message ids are the same in both
    // users' copies of a chat while the indexes are not
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub sender_message_index: Option<MessageIndex>,
    pub content: MessageContentInternal,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    pub og_previews: Vec<OgPreview>,
    pub mentioned: Vec<types::User>,
    pub mute_notification: bool,
}

// A message pushed to the recipient's copy of the chat, and the notification of it to push, if the
// recipient is to be notified
pub struct MessageReceived {
    pub message_event: EventWrapper<Message>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub notification: Option<DirectChatUserNotificationPayload>,
}

// Pushes a message to the recipient's copy of their chat with its sender, creating the chat if there
// is none, recording any crypto it carries in their message activity feed and any reply it makes to
// a message in another chat. Returns None if the message is skipped: because it is in a thread the
// recipient's copy of the chat doesn't have, or because it has already been received, since
// messages sent c2c may be retried.
pub fn receive_message<P: EventPusher>(
    user: &mut User,
    my_user_id: UserId,
    args: ReceiveMessageArgs,
    event_pusher: Option<P>,
    anonymized_id: u128,
    now: TimestampMillis,
) -> Option<MessageReceived> {
    let sender = args.sender;
    let chat_id = sender.into();
    let existing_chat = user.direct_chats.get(&chat_id);
    let thread_root_message_index = match &existing_chat {
        Some(chat) => chat.thread_root_message_index(args.thread_root_message_id).ok()?,
        None if args.thread_root_message_id.is_none() => None,
        None => return None,
    };
    if existing_chat.as_ref().is_some_and(|chat| {
        chat.events()
            .message_already_finalised(thread_root_message_index, args.message_id, false)
    }) {
        return None;
    }

    // What the message replies to is given by its index in this copy of the chat
    let replies_to = match args.replies_to {
        Some(C2CReplyContext::ThisChat(message_id)) => existing_chat
            .and_then(|chat| chat.main_events_reader().event_index(message_id.into()))
            .map(|event_index| ReplyContextInternal {
                chat_if_other: None,
                event_index,
            }),
        Some(C2CReplyContext::OtherChat(chat, thread_root_message_index, event_index)) => Some(ReplyContextInternal {
            chat_if_other: Some((chat.into(), thread_root_message_index)),
            event_index,
        }),
        None => None,
    };
    let chat_private_replying_to = match replies_to.as_ref().and_then(|r| r.chat_if_other) {
        Some((chat, None)) => Some(chat),
        _ => None,
    };

    let mut chat = user
        .direct_chats
        .get_or_create(my_user_id, sender, args.sender_user_type, || anonymized_id, now);

    let message_event = chat.push_message(
        PushMessageArgs {
            thread_root_message_index,
            message_id: args.message_id,
            sender,
            content: args.content,
            mentioned: Vec::new(),
            replies_to,
            forwarded: args.forwarding,
            sender_is_bot: args.sender_user_type.is_bot(),
            block_level_markdown: args.block_level_markdown,
            og_previews: args.og_previews,
            now,
            sender_context: None,
        },
        args.sender_message_index,
        event_pusher,
    );

    // A bot has read its own messages
    if args.sender_user_type.is_bot() {
        chat.mark_read_by_them_up_to(message_event.event.message_index, now);
    }

    let notification = (!args.mute_notification && !chat.notifications_muted.value && !user.suspended.value).then(|| {
        let content = &message_event.event.content;
        DirectChatUserNotificationPayload::DirectMessage(DirectMessageNotification {
            sender,
            thread_root_message_index,
            message_index: message_event.event.message_index,
            event_index: message_event.index,
            sender_name: args.sender_name,
            sender_display_name: args.sender_display_name,
            message_type: content.content_type().to_string(),
            message_text: content.notification_text(&args.mentioned, &[]),
            image_url: content.notification_image_url(),
            file_name: content.notification_file_name(),
            sender_avatar_id: args.sender_avatar_id,
            crypto_transfer: content.notification_crypto_transfer_details(&[]),
            call: None,
        })
    });
    drop(chat);

    if matches!(message_event.event.content, MessageContent::Crypto(_)) {
        user.push_message_activity(
            MessageActivityEvent {
                chat: Chat::Direct(chat_id),
                thread_root_message_index,
                message_index: message_event.event.message_index,
                message_id: message_event.event.message_id,
                event_index: message_event.index,
                activity: MessageActivity::Crypto,
                timestamp: now,
                user_id: Some(sender),
            },
            now,
        );
    }

    if let Some(chat) = chat_private_replying_to {
        user.direct_chats
            .mark_private_reply(sender, chat, message_event.event.message_index);
    }

    Some(MessageReceived {
        message_event,
        thread_root_message_index,
        notification,
    })
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
// completion to the recipient's message activity feed, and recording in the recipient's own record
// of the swap, if they have one, that it has ended. Returns whether the change was applied.
pub fn p2p_swap_change_status(user: &mut User, sender: UserId, args: P2PSwapStatusChange, now: TimestampMillis) -> bool {
    let Some(mut chat) = user.direct_chats.get_mut(&sender.into()) else {
        return false;
    };
    let completed = matches!(args.status, P2PSwapStatus::Completed(_));
    let ended = args.status.has_ended();
    let swap_id = chat.get_p2p_swap(None, args.message_id).map(|swap| swap.swap_id);

    if chat.set_p2p_swap_status(None, args.message_id, args.status, now).is_err() {
        return false;
    }

    let activity = if completed
        && let Some(message_event) = chat
            .events()
            .main_events_reader()
            .message_event_internal(args.message_id.into())
        && let Ok(thread_root_message_index) = chat.thread_root_message_index(args.thread_root_message_id)
    {
        Some(MessageActivityEvent {
            chat: Chat::Direct(sender.into()),
            thread_root_message_index,
            message_index: message_event.event.message_index,
            message_id: message_event.event.message_id,
            event_index: message_event.index,
            activity: MessageActivity::P2PSwapAccepted,
            timestamp: now,
            user_id: Some(sender),
        })
    } else {
        None
    };
    drop(chat);

    if ended && let Some(swap_id) = swap_id {
        user.p2p_swaps.mark_ended(swap_id, now);
    }
    if let Some(activity) = activity {
        user.push_message_activity(activity, now);
    }
    true
}

// Records the sender joining the call in the recipient's copy of the chat
pub fn join_video_call(chat: &mut DirectChat, sender: UserId, message_id: MessageId, now: TimestampMillis) {
    let _ = chat.set_video_call_presence(sender, message_id, VideoCallPresence::Default, now);
}

// Applies the sender's change to the chat's message TTL, creating the chat if the recipient doesn't
// have it yet. Each copy of the chat records the latest change, by who made it and the time they
// gave it, and the sender's change is applied if it supersedes that, so both copies settle on the
// same change.
pub fn set_events_ttl(
    user: &mut User,
    my_user_id: UserId,
    sender: UserId,
    args: SetEventsTtl,
    anonymized_chat_id: impl FnOnce() -> u128,
    now: TimestampMillis,
) {
    let mut chat = user
        .direct_chats
        .get_or_create(my_user_id, sender, UserType::User, anonymized_chat_id, now);
    let change = EventsTtlChange {
        by: sender,
        at: args.timestamp,
    };
    let apply = match chat.events_ttl_latest_change() {
        // Even if the chat was created by an earlier event from the sender, delivered after they
        // changed the TTL, eg. in the same batch as this one
        EventsTtlLatestChange::NeverChanged => true,
        // Events from a canister arrive in the order they were sent, so the sender's change
        // follows their previous one, even if both were given the same time
        EventsTtlLatestChange::Changed(latest) if latest.by == sender => true,
        EventsTtlLatestChange::Changed(latest) => change.supersedes(&latest),
        // The chat is from before the latest change was recorded, so the latest change is taken
        // to be the recipient's, at the time the TTL was last set
        EventsTtlLatestChange::Unknown => change.supersedes(&EventsTtlChange {
            by: my_user_id,
            at: chat.events().get_events_time_to_live().timestamp,
        }),
    };
    if apply {
        chat.apply_their_events_time_to_live(args.events_ttl, args.timestamp, now);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::{KeyScope, with_key_scope};
    use std::cell::Cell;

    thread_local! {
        static USERS_CREATED: Cell<u8> = const { Cell::new(0) };
    }

    // Each user is given their own key scope, as in a MultiUser canister, since a test can hold two
    // users, whose direct chats are each keyed by `key_id`s counting up from 1
    fn user() -> User {
        let count = USERS_CREATED.get();
        if count == 0 {
            let memory = MemoryManager::init(DefaultMemoryImpl::default());
            stable_memory_map::init_multi_user(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
        }
        USERS_CREATED.set(count + 1);
        User::new(Principal::from_slice(&[count + 1]), "username".to_string(), None, 100)
    }

    // Runs `f` against the user within their key scope
    fn with_user<U, R>(user: U, f: impl FnOnce(U) -> R) -> R
    where
        U: std::ops::Deref<Target = User>,
    {
        let scope = KeyScope::User(user.principal.as_slice()[0] as u16);
        with_key_scope(scope, || f(user))
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn text_message(sender: UserId, message_id: u64, replies_to: Option<C2CReplyContext>) -> ReceiveMessageArgs {
        ReceiveMessageArgs {
            sender,
            sender_user_type: UserType::User,
            sender_name: "sender".to_string(),
            sender_display_name: None,
            sender_avatar_id: None,
            thread_root_message_id: None,
            message_id: message_id.into(),
            sender_message_index: None,
            content: MessageContentInternal::Text(chat_events::TextContentInternal { text: "hi".to_string() }),
            replies_to,
            forwarding: false,
            block_level_markdown: false,
            og_previews: Vec::new(),
            mentioned: Vec::new(),
            mute_notification: false,
        }
    }

    #[test]
    fn reply_to_a_group_message_is_recorded_as_a_private_reply_once() {
        let (me, sender) = (user_id(1), user_id(2));
        let group: types::ChatId = Principal::from_slice(&[3; 10]).into();
        let replies_to = Some(C2CReplyContext::OtherChat(Chat::Group(group), None, 5.into()));
        let mut user = user();

        with_user(&mut user, |user| {
            let received =
                receive_message::<NullEventPusher>(user, me, text_message(sender, 1, replies_to.clone()), None, 1, 100)
                    .unwrap();

            assert_eq!(
                direct_chat::private_replies::take(group),
                vec![(sender, received.message_event.event.message_index)]
            );

            // The same message, retried, is skipped
            assert!(receive_message::<NullEventPusher>(user, me, text_message(sender, 1, replies_to), None, 1, 101).is_none());
            assert!(direct_chat::private_replies::take(group).is_empty());
        });
    }

    fn events_ttl(user: &User, them: UserId) -> Option<u64> {
        with_user(user, |user| {
            user.direct_chats
                .get(&them.into())
                .unwrap()
                .events()
                .get_events_time_to_live()
                .value
        })
    }

    // The user `me` changes the TTL at `now`, creating the chat if they don't have it, returning
    // the time the change is given, which is what is sent to the other user
    fn change(user: &mut User, me: UserId, them: UserId, value: u64, now: TimestampMillis) -> TimestampMillis {
        with_user(user, |user| {
            user.direct_chats
                .get_or_create(me, them, UserType::User, || 1, now)
                .set_events_time_to_live(me, Some(value), now)
                .unwrap()
        })
    }

    fn create_chat(user: &mut User, me: UserId, them: UserId, now: TimestampMillis) {
        with_user(user, |user| {
            user.direct_chats.get_or_create(me, them, UserType::User, || 1, now);
        });
    }

    // The user `me` receives the other user's change, which they made at `timestamp`
    fn receive(user: &mut User, me: UserId, sender: UserId, value: u64, timestamp: TimestampMillis, now: TimestampMillis) {
        with_user(user, |user| {
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
            )
        });
    }

    #[test]
    fn change_is_applied_to_a_chat_created_after_it_was_made() {
        // The sender's earlier message created the chat after they changed the TTL, as happens
        // when their events are batched
        let (me, sender) = (user_id(1), user_id(2));
        let mut user = user();
        create_chat(&mut user, me, sender, 100);

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
    fn change_is_applied_only_if_newer_than_the_recipients_own() {
        let (me, sender) = (user_id(1), user_id(2));
        for (timestamp, expected) in [(150, 2000), (250, 1000)] {
            let mut user = user();
            change(&mut user, me, sender, 2000, 200);

            receive(&mut user, me, sender, 1000, timestamp, 300);

            assert_eq!(events_ttl(&user, sender), Some(expected), "change made at {timestamp}");
        }
    }

    #[test]
    fn changes_made_at_the_same_time_are_settled_by_user_id() {
        // Each user changed the TTL at 100, and the user with the lower id wins in both copies
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());

        change(&mut user_a, a, b, 1000, 100);
        change(&mut user_b, b, a, 2000, 100);
        receive(&mut user_a, a, b, 2000, 100, 110);
        receive(&mut user_b, b, a, 1000, 100, 110);

        assert_eq!(events_ttl(&user_a, b), Some(1000));
        assert_eq!(events_ttl(&user_b, a), Some(1000));
    }

    #[test]
    fn copies_converge_when_both_users_set_the_ttl_on_a_new_chat() {
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());

        change(&mut user_a, a, b, 1000, 50);
        change(&mut user_b, b, a, 2000, 100);
        receive(&mut user_a, a, b, 2000, 100, 110);
        receive(&mut user_b, b, a, 1000, 50, 110);

        assert_eq!(events_ttl(&user_a, b), Some(2000));
        assert_eq!(events_ttl(&user_b, a), Some(2000));
    }

    #[test]
    fn copies_converge_when_one_user_changes_the_ttl_twice_before_the_other_hears() {
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());

        change(&mut user_b, b, a, 500, 5);
        receive(&mut user_a, a, b, 500, 5, 7);
        change(&mut user_a, a, b, 1000, 10);
        change(&mut user_a, a, b, 2000, 20);

        // B receives both of A's changes together
        receive(&mut user_b, b, a, 1000, 10, 100);
        receive(&mut user_b, b, a, 2000, 20, 100);

        assert_eq!(events_ttl(&user_a, b), Some(2000));
        assert_eq!(events_ttl(&user_b, a), Some(2000));
    }

    #[test]
    fn change_made_after_applying_the_other_users_change_in_the_same_round_supersedes_it() {
        // A's id sorts after B's, so a tie on time would settle in favour of B's change
        let (a, b) = (user_id(2), user_id(1));
        let (mut user_a, mut user_b) = (user(), user());

        // In the same round, A changes the TTL, applies B's change, then changes it again
        let first = change(&mut user_a, a, b, 1000, 100);
        let b_changed_at = change(&mut user_b, b, a, 2000, 100);
        receive(&mut user_a, a, b, 2000, b_changed_at, 100);
        let second = change(&mut user_a, a, b, 3000, 100);
        assert!(second > b_changed_at);

        receive(&mut user_b, b, a, 1000, first, 110);
        receive(&mut user_b, b, a, 3000, second, 110);

        assert_eq!(events_ttl(&user_a, b), Some(3000));
        assert_eq!(events_ttl(&user_b, a), Some(3000));
    }

    #[test]
    fn changes_made_after_one_given_a_later_time_are_not_given_an_earlier_one() {
        // B's id sorts before A's. In the same round, A applies B's change, then changes the TTL
        // twice, while B changes it again.
        let (a, b) = (user_id(2), user_id(1));
        let (mut user_a, mut user_b) = (user(), user());

        let b_first = change(&mut user_b, b, a, 500, 200);
        receive(&mut user_a, a, b, 500, b_first, 200);
        let a_first = change(&mut user_a, a, b, 1000, 200);
        let a_second = change(&mut user_a, a, b, 2000, 200);
        assert!(a_second >= a_first);
        let b_second = change(&mut user_b, b, a, 3000, 200);

        receive(&mut user_b, b, a, 1000, a_first, 210);
        receive(&mut user_b, b, a, 2000, a_second, 210);
        receive(&mut user_a, a, b, 3000, b_second, 210);

        assert_eq!(events_ttl(&user_a, b), events_ttl(&user_b, a));
    }

    #[test]
    fn changes_from_one_user_at_the_same_time_are_applied_in_order() {
        // B's id sorts after A's, so the tie-break on user ids alone wouldn't apply B's second change
        let (a, b) = (user_id(1), user_id(2));
        let (mut user_a, mut user_b) = (user(), user());
        create_chat(&mut user_a, a, b, 0);

        change(&mut user_b, b, a, 1000, 100);
        change(&mut user_b, b, a, 2000, 100);
        receive(&mut user_a, a, b, 1000, 100, 110);
        receive(&mut user_a, a, b, 2000, 100, 110);

        assert_eq!(events_ttl(&user_a, b), Some(2000));
        assert_eq!(events_ttl(&user_b, a), Some(2000));
    }
}
