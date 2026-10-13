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
    let user_to_remove = if block { latest_user_id(user_to_remove).await? } else { user_to_remove };

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

// The latest id of a user being blocked, who may be referred to by an id they had before being
// migrated to a MultiUser canister (eg. one seen in an old message), so that the block is never
// recorded under an old id. An unindexed id which the group doesn't know is looked up in the
// LocalUserIndex. Anything still held under an old id is moved onto the latest id first, so that
// a member under the old id is removed along with being blocked.
async fn latest_user_id(user_id: UserId) -> OCResult<UserId> {
    let (known_latest, local_user_index_canister_id) = read_state(|state| {
        (
            known_latest_user_id(&state.data, user_id),
            state.data.local_user_index_canister_id,
        )
    });

    let latest = match known_latest {
        Some(latest) => latest,
        None => {
            let args = local_user_index_canister::migrated_user_ids::Args { user_ids: vec![user_id] };
            let local_user_index_canister::migrated_user_ids::Response::Success(migrated) =
                local_user_index_canister_c2c_client::migrated_user_ids(local_user_index_canister_id, &args).await?;
            verify_not_frozen()?;
            migrated.get(&user_id).copied().unwrap_or(user_id)
        }
    };

    if latest != user_id {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.migrate_user_ids(&[user_id], latest, None, now);
        });
    }
    Ok(latest)
}

// The user's latest id if it is known without a lookup. An id carrying an index wasn't a User
// canister's, so can only have been migrated from as `MigratedUserIds` records. None for an
// unindexed id which `MigratedUserIds` doesn't know, which must be looked up.
fn known_latest_user_id(data: &Data, user_id: UserId) -> Option<UserId> {
    (user_id.is_indexed() || data.migrated_user_ids.contains(&user_id)).then(|| data.migrated_user_ids.latest(user_id))
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
    use stable_memory_map::StableMemoryMap;
    use types::{EventIndex, MessageIndex, UserIdAndPrincipal, UserType};

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
    fn a_member_blocked_by_an_old_id_is_moved_onto_their_latest_id_and_blocked_under_it() {
        let owner = UserIdAndPrincipal::new(new_user_id(1), Principal::from_slice(&[1]));
        let mut data = Data::new_for_tests(owner.user_id, owner.principal, String::new());
        let principal = Principal::from_slice(&[2]);
        data.chat.members.add(
            old_user_id(2),
            Some(principal),
            0,
            EventIndex::default(),
            MessageIndex::default(),
            false,
            UserType::User,
        );
        data.principal_to_user_id_map.insert(principal, old_user_id(2));

        // An indexed id is the user's latest, whereas an unindexed id the group doesn't know is
        // looked up
        assert_eq!(known_latest_user_id(&data, owner.user_id), Some(owner.user_id));
        assert_eq!(known_latest_user_id(&data, old_user_id(2)), None);

        // The lookup finds that they have been migrated, so their membership is moved onto their
        // latest id, under which they are then blocked, as `latest_user_id` and `commit` do
        data.migrate_user_ids(&[old_user_id(2)], new_user_id(2), None, 1);
        assert_eq!(known_latest_user_id(&data, old_user_id(2)), Some(new_user_id(2)));
        assert_eq!(data.principal_to_user_id_map.get(&principal), Some(new_user_id(2)));
        data.chat.remove_member(Caller::User(owner), new_user_id(2), true, 2).unwrap();
        data.remove_user(new_user_id(2), None);

        assert!(!data.chat.members.contains(&old_user_id(2)));
        assert!(!data.chat.members.contains(&new_user_id(2)));
        assert_eq!(data.chat.members.blocked(), vec![new_user_id(2)]);
    }
}
