use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::updates::delete_messages::enqueue_hard_delete_jobs;
use crate::updates::send_message::{SenderDetails, receive_message};
use crate::updates::start_video_call::handle_start_video_call;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use constants::HOUR_IN_MS;
use direct_chat::DirectChat;
use local_user_index_canister::is_user_or_multi_user_canister::Response as CanisterKind;
use rand::RngExt;
use types::{Achievement, CallKind, CanisterId, TimestampMillis, UserId, UserType};
use user_canister::c2c_user_canister_v2::*;
use user_canister::{
    DeleteUndeleteMessagesArgs as C2CDeleteUndeleteMessagesArgs, EditMessageArgs as C2CEditMessageArgs, SendMessagesArgs,
    SetEventsTtl, StartVideoCallArgs, TipMessageArgs as C2CTipMessageArgs, ToggleReactionArgs, UserCanisterEvent,
};
use user_core::updates::c2c_user_canister::{self, can_act_for};
use utils::migrated_user_ids::MigratedUserIds;

#[update(msgpack = true)]
#[trace]
async fn c2c_user_canister_v2(args: Args) -> Response {
    execute_update_async(|| c2c_user_canister_v2_impl(args)).await
}

async fn c2c_user_canister_v2_impl(args: Args) -> Response {
    // As in the User canister, the caller must be a User or MultiUser canister, and each event is
    // only applied if it is from a user that kind of canister can act for
    let caller_kind = verify_caller(&args).await;
    if caller_kind == CanisterKind::Neither {
        return Response::Success;
    }

    mutate_state(|state| {
        let caller = state.env.caller();
        for event in args.events {
            if !state
                .data
                .idempotency_checker
                .check(caller, event.created_at, event.idempotency_id)
            {
                continue;
            }
            let Event {
                sender,
                recipient,
                event,
                sender_previous_user_ids,
            } = event.value;
            if !can_act_for(caller_kind, sender, caller) {
                continue;
            }
            // Events for a user who isn't in this canister can never be applied, so are dropped
            if let Some(recipient_index) = state.index_of_local_user(recipient) {
                if caller_kind == CanisterKind::MultiUserCanister {
                    migrate_sender_user_id(recipient_index, sender, &sender_previous_user_ids, state);
                }
                apply_event(event, sender, recipient_index, state);
            }
        }
    });

    Response::Success
}

// Which kind of canister the caller is. A MultiUser canister the LocalUserIndex has already
// confirmed is cached, and a User canister whose user one of the recipients has a chat with is
// known. Any other caller is checked with the LocalUserIndex, which knows every user as soon as they
// register, and cached if it is a MultiUser canister.
async fn verify_caller(args: &Args) -> CanisterKind {
    let (caller, local_user_index_canister_id, known) = read_state(|state| {
        let caller = state.env.caller();
        (
            caller,
            state.data.local_user_index_canister_id,
            known_caller_kind(caller, args, state),
        )
    });
    if let Some(kind) = known {
        return kind;
    }

    // Every LocalUserIndex holds all users, so asking this canister's own avoids a cross-subnet call
    let kind = match local_user_index_canister_c2c_client::is_user_or_multi_user_canister(
        local_user_index_canister_id,
        &local_user_index_canister::is_user_or_multi_user_canister::Args { canister_id: caller },
    )
    .await
    {
        Ok(kind) => kind,
        // Failing the call means the sender retries it
        Err(_) => ic_cdk::trap("Failed to call local_user_index to verify the caller"),
    };
    if kind == CanisterKind::MultiUserCanister {
        mutate_state(|state| state.data.known_multi_user_canisters.insert(caller));
    }
    kind
}

fn known_caller_kind(caller: CanisterId, args: &Args, state: &RuntimeState) -> Option<CanisterKind> {
    if state.data.known_multi_user_canisters.contains(&caller) {
        return Some(CanisterKind::MultiUserCanister);
    }
    let caller_user_id = UserId::from(caller);
    let has_chat_with_caller = args.events.iter().any(|e| {
        state
            .with_user(e.value.recipient, |user| {
                user.direct_chats.user_type(&caller_user_id.into()) == Some(UserType::User)
            })
            .unwrap_or_default()
    });
    has_chat_with_caller.then_some(CanisterKind::UserCanister)
}

// Moves what the user at `recipient_index` holds under the sender's previous ids, such as their chat
// with the sender and any block of them, onto the sender's id. A sender migrated to a MultiUser
// canister may get here before the notice of their new id, which would otherwise leave their events
// to start a second chat, or get past a block held under their previous id.
pub(crate) fn migrate_sender_user_id(
    recipient_index: u16,
    sender: UserId,
    sender_previous_user_ids: &[UserId],
    state: &mut RuntimeState,
) {
    if sender_previous_user_ids.is_empty() {
        return;
    }
    let now = state.env.now();
    state
        .data
        .migrated_user_ids
        .insert_previous_ids(sender_previous_user_ids, sender);
    let migrated_user_ids = &state.data.migrated_user_ids;
    state.data.users.with_user_mut(recipient_index, |user| {
        user.migrate_sender_user_id(sender, sender_previous_user_ids, migrated_user_ids, now)
    });
}

// Applies an event from `sender` to the user at `recipient_index`, as the User canister's
// `c2c_user_canister` does, unless the recipient has blocked the sender. Events from users in other
// canisters arrive via `c2c_user_canister_v2`, while those from users in this canister are applied
// straight away (see `RuntimeState::send_user_canister_event`), so an event has the same effect
// whichever canister its sender is in. Events for features the MultiUser canister doesn't support
// yet are dropped.
pub(crate) fn apply_event(event: UserCanisterEvent, sender: UserId, recipient_index: u16, state: &mut RuntimeState) {
    if is_blocked(recipient_index, sender, state) {
        return;
    }
    let now = state.env.now();

    match event {
        UserCanisterEvent::SendMessages(args) => send_messages(*args, sender, recipient_index, now, state),
        UserCanisterEvent::EditMessage(args) => edit_message(*args, sender, recipient_index, now, state),
        UserCanisterEvent::DeleteMessages(args) => delete_messages(*args, sender, recipient_index, now, state),
        UserCanisterEvent::UndeleteMessages(args) => undelete_messages(*args, sender, recipient_index, now, state),
        UserCanisterEvent::ToggleReaction(args) => toggle_reaction(*args, sender, recipient_index, now, state),
        UserCanisterEvent::MarkMessagesRead(args) => {
            with_chat_mut(recipient_index, sender, state, |chat, _| {
                chat.mark_read_by_them_up_to(args.read_up_to, now)
            });
        }
        UserCanisterEvent::SetEventsTtl(args) => set_events_ttl(*args, sender, recipient_index, now, state),
        UserCanisterEvent::SetReferralStatus(status) => state.set_referral_status(recipient_index, sender, &[], *status, now),
        UserCanisterEvent::SetReferralStatusV2(args) => {
            state.set_referral_status(recipient_index, sender, &args.previous_user_ids, args.status, now)
        }
        UserCanisterEvent::StartVideoCall(args) => start_video_call(*args, sender, recipient_index, state),
        UserCanisterEvent::JoinVideoCall(args) => {
            with_chat_mut(recipient_index, sender, state, |chat, _| {
                c2c_user_canister::join_video_call(chat, sender, args.message_id, now)
            });
        }
        UserCanisterEvent::TipMessage(args) => tip_message(*args, sender, recipient_index, now, state),
        UserCanisterEvent::P2PSwapStatusChange(args) => {
            let message_id = args.message_id;
            let ended = args.status.has_ended();
            let applied = state
                .data
                .users
                .with_user_mut(recipient_index, |user| {
                    c2c_user_canister::p2p_swap_change_status(user, sender, *args, now)
                })
                .unwrap_or_default();
            // The change is applied to the swap in the chat's main timeline
            if applied && ended {
                state.cancel_mark_p2p_swap_expired_job(recipient_index, sender, None, message_id);
            }
        }
    }
}

fn is_blocked(recipient_index: u16, sender: UserId, state: &RuntimeState) -> bool {
    state
        .data
        .users
        .with_user(recipient_index, |user| user.blocked_users.contains(&sender))
        .unwrap_or(true)
}

// Runs `f` against the copy of the chat with `sender` held by the user at `recipient_index`, if they
// have one, along with the latest ids of migrated users, which the chat's events are checked against
fn with_chat_mut<R>(
    recipient_index: u16,
    sender: UserId,
    state: &mut RuntimeState,
    f: impl FnOnce(&mut DirectChat, &MigratedUserIds) -> R,
) -> Option<R> {
    let migrated_user_ids = &state.data.migrated_user_ids;
    state
        .data
        .users
        .with_user_mut(recipient_index, |user| {
            user.direct_chats
                .get_mut(&sender.into())
                .map(|mut chat| f(&mut chat, migrated_user_ids))
        })
        .flatten()
}

fn send_messages(args: SendMessagesArgs, sender: UserId, recipient_index: u16, now: TimestampMillis, state: &mut RuntimeState) {
    let mut achievements = vec![Achievement::ReceivedDirectMessage];
    if args
        .messages
        .iter()
        .any(|m| matches!(m.content, MessageContentInternal::Crypto(_)))
    {
        achievements.push(Achievement::ReceivedCrypto);
    }
    state.award_achievements_and_notify(recipient_index, achievements, now);

    for message in args.messages {
        let sender_details = SenderDetails {
            name: args.sender_name.clone(),
            display_name: args.sender_display_name.clone(),
            avatar_id: args.sender_avatar_id,
        };
        receive_message(recipient_index, sender, sender_details, message, now, state);
    }
}

fn edit_message(
    args: C2CEditMessageArgs,
    sender: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    with_chat_mut(recipient_index, sender, state, |chat, migrated_user_ids| {
        c2c_user_canister::edit_message(chat, sender, args, now, migrated_user_ids)
    });
}

fn delete_messages(
    args: C2CDeleteUndeleteMessagesArgs,
    sender: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let Some((thread_root_message_index, deleted)) =
        with_chat_mut(recipient_index, sender, state, |chat, migrated_user_ids| {
            c2c_user_canister::delete_messages(chat, sender, args, now, migrated_user_ids)
        })
        .flatten()
    else {
        return;
    };

    enqueue_hard_delete_jobs(recipient_index, sender.into(), thread_root_message_index, deleted, state);
}

fn undelete_messages(
    args: C2CDeleteUndeleteMessagesArgs,
    sender: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let Some((thread_root_message_index, undeleted)) =
        with_chat_mut(recipient_index, sender, state, |chat, migrated_user_ids| {
            c2c_user_canister::undelete_messages(chat, sender, args, now, migrated_user_ids)
        })
        .flatten()
    else {
        return;
    };

    HardDeleteMessageContentJob::cancel(
        &mut state.data.timer_jobs,
        recipient_index,
        sender.into(),
        thread_root_message_index,
        &undeleted,
    );
}

// As in the User canister, a reaction added to the recipient's own message notifies them, appears
// in their message activity feed and earns them an achievement
fn toggle_reaction(
    args: ToggleReactionArgs,
    sender: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let Some(reaction) = with_chat_mut(recipient_index, sender, state, |chat, migrated_user_ids| {
        c2c_user_canister::toggle_reaction(chat, sender, args, now, migrated_user_ids)
    })
    .flatten() else {
        return;
    };

    let suspended = state
        .data
        .users
        .with_user_mut(recipient_index, |user| {
            user.push_message_activity(reaction.activity, now);
            user.suspended.value
        })
        .unwrap_or_default();
    if let Some(notification) = reaction.notification
        && !suspended
    {
        state.push_notification(Some(sender), recipient_index, notification, now);
    }
    state.award_achievement_and_notify(recipient_index, Achievement::HadMessageReactedTo, now);
}

// Records in the initiator's copy of the chat the call the callee's copy holds, as the User canister
// does on the `StartVideoCall` event
fn start_video_call(args: StartVideoCallArgs, callee: UserId, initiator_index: u16, state: &mut RuntimeState) {
    let initiator = state.user_id(initiator_index);
    handle_start_video_call(
        initiator_index,
        args.message_id,
        Some(args.message_index),
        initiator,
        callee,
        if args.audio_only { CallKind::Audio } else { CallKind::Video },
        args.max_duration.unwrap_or(HOUR_IN_MS),
        state,
    );
}

// As in the User canister, a tip on the recipient's message notifies them, appears in their message
// activity feed and earns them an achievement
fn tip_message(args: C2CTipMessageArgs, sender: UserId, recipient_index: u16, now: TimestampMillis, state: &mut RuntimeState) {
    let recipient = state.user_id(recipient_index);
    let Some(received) = with_chat_mut(recipient_index, sender, state, |chat, migrated_user_ids| {
        c2c_user_canister::tip_message(chat, sender, recipient, args, now, migrated_user_ids)
    })
    .flatten() else {
        return;
    };

    if let Some(notification) = received.notification {
        state.push_notification(Some(sender), recipient_index, notification, now);
    }
    if let Some(activity) = received.activity {
        state
            .data
            .users
            .with_user_mut(recipient_index, |user| user.push_message_activity(activity, now));
    }
    state.award_achievement_and_notify(recipient_index, Achievement::HadMessageTipped, now);
}

fn set_events_ttl(args: SetEventsTtl, sender: UserId, recipient_index: u16, now: TimestampMillis, state: &mut RuntimeState) {
    let recipient = state.user_id(recipient_index);
    let anonymized_chat_id: u128 = state.env.rng().random();
    state.data.users.with_user_mut(recipient_index, |user| {
        c2c_user_canister::set_events_ttl(user, recipient, sender, args, || anonymized_chat_id, now)
    });
}
