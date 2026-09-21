use crate::updates::c2c_send_messages::{SenderStatus, get_status_of_sender, verify_user};
use crate::updates::c2c_user_canister::process_event;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use std::collections::BTreeSet;
use types::{UserId, UserType};
use user_canister::c2c_user_canister_v2::*;

#[update(msgpack = true)]
#[trace]
async fn c2c_user_canister_v2(args: Args) -> Response {
    execute_update_async(|| c2c_user_canister_v2_impl(args)).await
}

// As `c2c_user_canister`, except that each event names its sender and recipient, so the caller may
// be a MultiUser canister sending on behalf of any of its users. Only the events for this canister's
// user are applied, and only those from a sender the caller holds. Each sender is checked just as
// the caller is in `c2c_user_canister`: a sender this user has blocked is ignored, as is one which
// isn't a known OpenChat user.
async fn c2c_user_canister_v2_impl(args: Args) -> Response {
    let (caller, my_user_id) = read_state(|state| (state.env.caller(), UserId::from(state.env.canister_id())));

    let senders: BTreeSet<UserId> = args
        .events
        .iter()
        .filter(|e| e.value.recipient == my_user_id && is_sender_held_by(e.value.sender, caller))
        .map(|e| e.value.sender)
        .collect();

    let mut accepted_senders = BTreeSet::new();
    for sender in senders {
        let accepted = match read_state(|state| get_status_of_sender(sender, state)) {
            SenderStatus::Ok(_, user_type) => user_type == UserType::User,
            SenderStatus::Blocked => false,
            SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
                verify_user(local_user_index_canister_id, user_id).await == Some(UserType::User)
            }
        };
        if accepted {
            accepted_senders.insert(sender);
        }
    }

    mutate_state(|state| {
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
            // Blocking is checked again in case the sender was blocked while any senders were
            // being looked up
            if recipient == my_user_id && accepted_senders.contains(&sender) && !state.data.blocked_users.contains(&sender) {
                process_event(event, sender, state);
            }
        }
    });

    Response::Success
}

// Whether the sender is the calling canister's user, either as the user a User canister holds, or
// as one of the users a MultiUser canister holds
fn is_sender_held_by(sender: UserId, caller: candid::Principal) -> bool {
    sender == UserId::from(caller) || UserId::acting_as(caller, Some(sender)).is_some()
}
