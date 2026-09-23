use crate::updates::c2c_user_canister::process_event;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::is_user_or_multi_user_canister::Response as CanisterKind;
use types::{CanisterId, UserId, UserType};
use user_canister::c2c_user_canister_v2::*;
use user_core::updates::c2c_user_canister::can_act_for;

#[update(msgpack = true)]
#[trace]
async fn c2c_user_canister_v2(args: Args) -> Response {
    execute_update_async(|| c2c_user_canister_v2_impl(args)).await
}

// As `c2c_user_canister`, except that each event names its sender and recipient, so the caller may
// be a MultiUser canister sending on behalf of any of its users. The caller must be a User or
// MultiUser canister, and each event is only applied if it is for this canister's user, from a user
// that kind of canister can act for, and not from a user this user has blocked.
async fn c2c_user_canister_v2_impl(args: Args) -> Response {
    let caller_kind = verify_caller().await;
    if caller_kind == CanisterKind::Neither {
        return Response::Success;
    }

    mutate_state(|state| {
        let caller = state.env.caller();
        let my_user_id: UserId = state.env.canister_id().into();
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
            if recipient == my_user_id
                && can_act_for(caller_kind, sender, caller)
                && !state.data.user.blocked_users.contains(&sender)
            {
                process_event(event, sender, state);
            }
        }
    });

    Response::Success
}

// Which kind of canister the caller is. A MultiUser canister the UserIndex has already confirmed is
// cached, and a User canister whose user this user has a chat with is known.
// Any other caller is checked with the UserIndex, and cached if it is a MultiUser canister. A user
// who has only just registered may not be known to the UserIndex yet, since it learns of them via an
// event from their LocalUserIndex, so a caller the UserIndex doesn't know is then looked up in the
// LocalUserIndex, which knows users as soon as they register.
pub(crate) async fn verify_caller() -> CanisterKind {
    let (caller, local_user_index_canister_id, known) = read_state(|state| {
        let caller = state.env.caller();
        (
            caller,
            state.data.local_user_index_canister_id,
            known_caller_kind(caller, state),
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
        Err(_) => panic!("Failed to call local_user_index to verify the caller"),
    };
    if kind == CanisterKind::MultiUserCanister {
        mutate_state(|state| state.data.known_multi_user_canisters.insert(caller));
    }
    kind
}

fn known_caller_kind(caller: CanisterId, state: &RuntimeState) -> Option<CanisterKind> {
    if state.data.known_multi_user_canisters.contains(&caller) {
        Some(CanisterKind::MultiUserCanister)
    } else if state
        .data
        .user
        .direct_chats
        .get(&UserId::from(caller).into())
        .is_some_and(|chat| chat.user_type == UserType::User)
    {
        Some(CanisterKind::UserCanister)
    } else {
        None
    }
}
