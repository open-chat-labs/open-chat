use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{Data, RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::remove_participant::*;
use group_chat_core::GroupRoleInternal;
use local_user_index_canister_c2c_client::lookup_user;
use multi_user_canister::{GroupCanisterEvent, RemovedFromGroup};
use oc_error_codes::OCErrorCode;
use types::{BotCaller, BotPermissions, Caller, CanisterId, ChatPermission, OCResult, UnitResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn block_user(args: group_canister::block_user::Args) -> UnitResult {
    execute_update_async(|| remove_participant_impl(args.user_id, true, None))
        .await
        .into()
}

#[update(msgpack = true)]
#[trace]
async fn remove_participant(args: Args) -> UnitResult {
    execute_update_async(|| remove_participant_impl(args.user_id, false, None))
        .await
        .into()
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_bot_remove_user(args: group_canister::c2c_bot_remove_user::Args) -> UnitResult {
    execute_update_async(|| {
        remove_participant_impl(
            args.user_id,
            args.block,
            Some(Caller::BotV2(BotCaller {
                bot: args.bot_id,
                initiator: args.initiator.clone(),
            })),
        )
    })
    .await
    .into()
}

async fn remove_participant_impl(user_to_remove: UserId, block: bool, ext_caller: Option<Caller>) -> OCResult {
    read_state(|state| state.data.verify_not_old_user_id(user_to_remove))?;

    // Check the caller can remove the user
    let prepare_result = match read_state(|state| prepare(user_to_remove, block, ext_caller, state))? {
        Some(ok) => ok,
        None => return Ok(()),
    };

    // If the user is an owner of the group then call the local_user_index
    // to check whether they are a "platform moderator" in which case this removal
    // is not authorized
    if prepare_result.is_user_to_remove_an_owner {
        match lookup_user(user_to_remove.as_principal(), prepare_result.local_user_index_canister_id).await? {
            Some(user) if !user.is_platform_moderator => (),
            _ => return Err(OCErrorCode::InitiatorNotAuthorized.into()),
        }
    }

    // Remove the user from the group, unless it has been frozen (eg. to be imported into a community)
    // while awaiting a lookup
    verify_not_frozen()?;
    mutate_state(|state| commit(user_to_remove, block, prepare_result.remove, prepare_result.removed_by, state))
}

// The group may have been frozen (including to be imported into a community) while awaiting a call
fn verify_not_frozen() -> OCResult {
    if read_state(|state| state.data.is_frozen()) {
        Err(OCErrorCode::ChatFrozen.into())
    } else {
        Ok(())
    }
}

struct PrepareResult {
    removed_by: Caller,
    local_user_index_canister_id: CanisterId,
    is_user_to_remove_an_owner: bool,
    remove: bool,
}

fn prepare(
    user_to_remove: UserId,
    block: bool,
    ext_caller: Option<Caller>,
    state: &RuntimeState,
) -> OCResult<Option<PrepareResult>> {
    if block && !state.data.chat.is_public.value {
        return Err(OCErrorCode::ChatNotPublic.into());
    }

    let caller = state.verified_caller(ext_caller)?;

    if caller.agent() == user_to_remove {
        Err(OCErrorCode::CannotRemoveSelf.into())
    } else {
        let (remove, user_to_remove_role) = match state.data.chat.members.get(&user_to_remove) {
            Some(member_to_remove) => (true, member_to_remove.role().value),
            None => {
                if !state.data.chat.invited_users.contains(&user_to_remove)
                    && (!block || state.data.chat.members.is_blocked(&user_to_remove))
                {
                    return Err(OCErrorCode::NoChange.into());
                }
                (false, GroupRoleInternal::Member) // We still want to remove an invite and/or block the user
            }
        };

        if let Caller::BotV2(bot_caller) = &caller
            && !state.data.is_bot_permitted(
                &bot_caller.bot,
                &bot_caller.initiator,
                &BotPermissions::from_chat_permission(ChatPermission::RemoveMembers),
            )
        {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }

        if let Some(initiator) = caller.initiator() {
            let member = state.data.chat.members.get_verified_member(initiator)?;
            if !member
                .role()
                .can_remove_members_with_role(user_to_remove_role, &state.data.chat.permissions)
            {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
        }

        Ok(Some(PrepareResult {
            removed_by: caller,
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            is_user_to_remove_an_owner: user_to_remove_role.is_owner(),
            remove,
        }))
    }
}

fn commit(user_to_remove: UserId, block: bool, remove: bool, caller: Caller, state: &mut RuntimeState) -> OCResult {
    let agent = caller.agent();
    let is_bot = state.data.chat.members.bots().contains_key(&user_to_remove);

    let bot_notification = state
        .data
        .chat
        .remove_member(caller, user_to_remove, block, state.env.now())?;

    if remove {
        state.data.remove_user(user_to_remove, None);
    }

    state.push_bot_notification(bot_notification);
    handle_activity_notification(state);

    if remove {
        // The user's canister is told via the queue of events for users, which keeps them in order and
        // sends them on to the user's new id if they've been migrated to a MultiUser canister. A bot's
        // canister takes no such events.
        if !is_bot {
            let now = state.env.now();
            state.push_event_to_user(
                user_to_remove,
                GroupCanisterEvent::RemovedFromGroup(Box::new(RemovedFromGroup {
                    removed_by: agent,
                    blocked: block,
                    group_name: state.data.chat.name.value.clone(),
                    public: state.data.chat.is_public.value,
                })),
                now,
            );
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_principal::Principal;

    use types::{EventIndex, MessageIndex, UserType};

    fn canister_id(i: u8) -> CanisterId {
        CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0, i, 1, 1])
    }

    // The User canister id a migrated user had, and the id they were migrated to
    fn old_user_id(i: u8) -> UserId {
        canister_id(100 + i).into()
    }

    fn new_user_id(i: u8) -> UserId {
        UserId::new_indexed(canister_id(1), i as u16)
    }

    #[test]
    fn a_user_canister_id_is_refused_unless_it_is_a_bot_member() {
        let owner = new_user_id(1);
        let mut data = Data::new_for_tests(owner, Principal::from_slice(&[1]), String::new());
        let bot_id: UserId = canister_id(50).into();
        data.chat.members.add(
            bot_id,
            None,
            0,
            EventIndex::default(),
            MessageIndex::default(),
            false,
            UserType::Bot,
        );

        assert!(data.verify_not_old_user_id(old_user_id(2)).is_err());
        assert!(data.verify_not_old_user_id(bot_id).is_ok());
        assert!(data.verify_not_old_user_id(new_user_id(2)).is_ok());
        // Bots without canisters of their own and webhooks have ids which aren't canisters'
        assert!(data.verify_not_old_user_id(Principal::from_slice(&[1; 8]).into()).is_ok());
    }
}
