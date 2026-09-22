use crate::timer_job_types::HardDeleteMessageContentJob;
use crate::updates::delete_messages::enqueue_hard_delete_jobs;
use crate::updates::send_message::{SenderDetails, receive_message};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use local_user_index_canister::is_user_or_multi_user_canister::Response as CanisterKind;
use rand::RngExt;
use types::{Achievement, CanisterId, TimestampMillis, UserId, UserType};
use user_canister::c2c_user_canister_v2::*;
use user_canister::{
    DeleteUndeleteMessagesArgs as C2CDeleteUndeleteMessagesArgs, EditMessageArgs as C2CEditMessageArgs, SendMessagesArgs,
    SetEventsTtl, ToggleReactionArgs, UserCanisterEvent,
};
use user_core::updates::c2c_user_canister::{self, can_act_for};

#[update(msgpack = true)]
#[trace]
async fn c2c_user_canister_v2(args: Args) -> Response {
    // As in the User canister, the caller must be a User or MultiUser canister, and each event is
    // only applied if it is from a user that kind of canister can act for. A sender the recipient
    // has blocked is skipped when the event is applied.
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
            } = event.value;
            if !can_act_for(caller_kind, sender, caller) {
                continue;
            }
            // Events for a user who isn't in this canister can never be applied, so are dropped
            if let Some(recipient_index) = state.index_of_local_user(recipient)
                && !is_blocked(recipient_index, sender, state)
            {
                process_event(event, sender, recipient_index, state);
            }
        }
    });

    Response::Success
}

// Which kind of canister the caller is. A MultiUser canister the UserIndex has already confirmed is
// cached, and a User canister whose user one of the recipients has a chat with is known.
// Any other caller is checked with the UserIndex, and cached if it is a MultiUser canister. A user
// who has only just registered may not be known to the UserIndex yet, since it learns of them via an
// event from their LocalUserIndex, so a caller the UserIndex doesn't know is then looked up in the
// LocalUserIndex, which knows users as soon as they register.
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
                user.direct_chats
                    .get(&caller_user_id.into())
                    .is_some_and(|chat| chat.user_type == UserType::User)
            })
            .unwrap_or_default()
    });
    has_chat_with_caller.then_some(CanisterKind::UserCanister)
}

fn is_blocked(recipient_index: u16, sender: UserId, state: &RuntimeState) -> bool {
    state
        .data
        .users
        .with_user(recipient_index, |user| user.blocked_users.contains(&sender))
        .unwrap_or(true)
}

// Applies an event from `sender`, who is in another canister, to the copy of their chat held by the
// user at `recipient_index`, as the User canister's `c2c_user_canister` does. Events for features the
// MultiUser canister doesn't support yet are dropped.
fn process_event(event: UserCanisterEvent, sender: UserId, recipient_index: u16, state: &mut RuntimeState) {
    let now = state.env.now();
    let recipient = state.user_id(recipient_index);

    match event {
        UserCanisterEvent::SendMessages(args) => send_messages(*args, sender, recipient_index, now, state),
        UserCanisterEvent::EditMessage(args) => edit_message(*args, sender, recipient, now, state),
        UserCanisterEvent::DeleteMessages(args) => delete_messages(*args, sender, recipient, recipient_index, now, state),
        UserCanisterEvent::UndeleteMessages(args) => undelete_messages(*args, sender, recipient, recipient_index, now, state),
        UserCanisterEvent::ToggleReaction(args) => toggle_reaction(*args, sender, recipient, recipient_index, now, state),
        UserCanisterEvent::MarkMessagesRead(args) => {
            state.with_their_direct_chat_mut(sender, recipient, |chat| chat.mark_read_by_them_up_to(args.read_up_to, now));
        }
        UserCanisterEvent::SetEventsTtl(args) => set_events_ttl(*args, sender, recipient, recipient_index, now, state),
        UserCanisterEvent::SetReferralStatus(status) => state.set_referral_status(recipient_index, sender, *status, now),
        // TODO: Handle these once the MultiUser canister supports tips, P2P swaps and video calls
        UserCanisterEvent::TipMessage(_)
        | UserCanisterEvent::P2PSwapStatusChange(_)
        | UserCanisterEvent::StartVideoCall(_)
        | UserCanisterEvent::JoinVideoCall(_) => {}
    }
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

fn edit_message(args: C2CEditMessageArgs, sender: UserId, recipient: UserId, now: TimestampMillis, state: &mut RuntimeState) {
    state.with_their_direct_chat_mut(sender, recipient, |chat| {
        c2c_user_canister::edit_message(chat, sender, args, now)
    });
}

fn delete_messages(
    args: C2CDeleteUndeleteMessagesArgs,
    sender: UserId,
    recipient: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let Some((thread_root_message_index, deleted)) = state
        .with_their_direct_chat_mut(sender, recipient, |chat| {
            c2c_user_canister::delete_messages(chat, sender, args, now)
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
    recipient: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let Some((thread_root_message_index, undeleted)) = state
        .with_their_direct_chat_mut(sender, recipient, |chat| {
            c2c_user_canister::undelete_messages(chat, sender, args, now)
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
    recipient: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let Some(reaction) = state
        .with_their_direct_chat_mut(sender, recipient, |chat| {
            c2c_user_canister::toggle_reaction(chat, sender, args, now)
        })
        .flatten()
    else {
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

fn set_events_ttl(
    args: SetEventsTtl,
    sender: UserId,
    recipient: UserId,
    recipient_index: u16,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let anonymized_chat_id: u128 = state.env.rng().random();
    state.data.users.with_user_mut(recipient_index, |user| {
        c2c_user_canister::set_events_ttl(user, recipient, sender, args, || anonymized_chat_id, now)
    });
}
