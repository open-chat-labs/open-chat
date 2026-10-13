use crate::{
    Data, RuntimeState, activity_notifications::handle_activity_notification, execute_update_async,
    guards::caller_is_local_user_index, model::events::CommunityEventInternal, mutate_state, read_state,
    updates::remove_member_from_channel::remove_member_from_channel_impl,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member::*;
use local_user_index_canister_c2c_client::lookup_user;
use multi_user_canister::{CommunityCanisterEvent, RemovedFromCommunity};
use oc_error_codes::OCErrorCode;
use std::collections::HashMap;
use types::{
    BotCaller, BotPermissions, Caller, CanisterId, ChatPermission, CommunityMembersRemoved, CommunityPermission, CommunityRole,
    CommunityUsersBlocked, OCResult, UnitResult, UserId,
};

#[update(msgpack = true)]
#[trace]
async fn block_user(args: community_canister::block_user::Args) -> UnitResult {
    execute_update_async(|| remove_member_impl(args.user_id, true, None)).await
}

#[update(msgpack = true)]
#[trace]
async fn remove_member(args: Args) -> UnitResult {
    execute_update_async(|| remove_member_impl(args.user_id, false, None)).await
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_bot_remove_user(args: community_canister::c2c_bot_remove_user::Args) -> UnitResult {
    execute_update_async(|| c2c_bot_remove_user_impl(args)).await
}

async fn c2c_bot_remove_user_impl(args: community_canister::c2c_bot_remove_user::Args) -> UnitResult {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    if !read_state(|state| {
        let required_permissions = if args.channel_id.is_some() {
            BotPermissions::from_chat_permission(ChatPermission::RemoveMembers)
        } else {
            BotPermissions::from_community_permission(CommunityPermission::RemoveMembers)
        };

        state
            .data
            .is_bot_permitted(&bot_caller.bot, args.channel_id, &bot_caller.initiator, &required_permissions)
    }) {
        return OCErrorCode::InitiatorNotAuthorized.into();
    }

    if let Some(channel_id) = args.channel_id {
        mutate_state(|state| remove_member_from_channel_impl(channel_id, args.user_id, Some(Caller::BotV2(bot_caller)), state))
            .into()
    } else {
        remove_member_impl(args.user_id, args.block, Some(Caller::BotV2(bot_caller))).await
    }
}

async fn remove_member_impl(user_id: UserId, block: bool, ext_caller: Option<Caller>) -> UnitResult {
    let user_id = if block {
        match latest_user_id(user_id).await {
            Ok(user_id) => user_id,
            Err(error) => return Response::Error(error),
        }
    } else {
        user_id
    };

    // Check the caller can remove the user
    let prepare_result = match read_state(|state| prepare(user_id, block, ext_caller, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    // If the user is an owner of the community then call the local_user_index
    // to check whether they are a "platform moderator" in which case this removal
    // is not authorized
    if prepare_result.is_user_to_remove_an_owner {
        match lookup_user(user_id.as_principal(), prepare_result.local_user_index_canister_id).await {
            Ok(Some(user)) if !user.is_platform_moderator => (),
            Ok(_) => return Response::Error(OCErrorCode::InitiatorNotAuthorized.into()),
            Err(error) => return Response::Error(error.into()),
        }
    }

    // Remove the user from the community, unless it has been frozen while awaiting a lookup
    if let Err(error) = verify_not_frozen() {
        return Response::Error(error);
    }
    mutate_state(|state| commit(user_id, block, prepare_result.removed_by, state));

    Response::Success
}

// The latest id of a user being blocked, who may be referred to by an id they had before being
// migrated to a MultiUser canister (eg. one seen in an old message), so that the block is never
// recorded under an old id. An unindexed id which the community doesn't know is looked up in the
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

// The community may have been frozen while awaiting a call
fn verify_not_frozen() -> OCResult {
    if read_state(|state| state.data.is_frozen()) {
        Err(OCErrorCode::CommunityFrozen.into())
    } else {
        Ok(())
    }
}

struct PrepareResult {
    removed_by: UserId,
    local_user_index_canister_id: CanisterId,
    is_user_to_remove_an_owner: bool,
}

fn prepare(user_id: UserId, block: bool, ext_caller: Option<Caller>, state: &RuntimeState) -> OCResult<PrepareResult> {
    if block && !state.data.is_public.value {
        return Err(OCErrorCode::CommunityNotPublic.into());
    }

    let caller = state.verified_caller(ext_caller)?;
    let agent = caller.agent();

    if agent == user_id {
        Err(OCErrorCode::CannotRemoveSelf.into())
    } else {
        let user_to_remove_role = match state.data.members.get_by_user_id(&user_id) {
            Some(member_to_remove) => member_to_remove.role(),
            None => {
                if !state.data.invited_users.contains(&user_id) && (!block || state.data.members.is_blocked(&user_id)) {
                    return Err(OCErrorCode::NoChange.into());
                }
                CommunityRole::Member // We still want to remove an invite and/or block the user
            }
        };

        // Check if the caller is authorized to remove the user
        if let Some(initiator) = caller.initiator() {
            let member = state.data.members.get_verified_member(initiator.as_principal())?;
            if !member
                .role()
                .can_remove_members_with_role(user_to_remove_role, &state.data.permissions)
            {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
        }

        Ok(PrepareResult {
            removed_by: agent,
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            is_user_to_remove_an_owner: user_to_remove_role.is_owner(),
        })
    }
}

fn commit(user_id: UserId, block: bool, removed_by: UserId, state: &mut RuntimeState) {
    let now = state.env.now();
    let is_bot = state.data.members.bots().contains_key(&user_id);

    // Remove the user from the community
    let removed_member = state.data.remove_user_from_community(user_id, None, now);
    let removed = removed_member.is_some();

    let blocked = block && state.data.members.block(user_id, now);

    let referred_by = removed_member
        .and_then(|r| r.referred_by)
        .map_or(HashMap::new(), |referred_by| HashMap::from_iter([(user_id, referred_by)]));

    let invite_removed = state.data.invited_users.remove(&user_id, now).is_some();

    // Push relevant event
    let event = if blocked {
        let event = CommunityUsersBlocked {
            user_ids: vec![user_id],
            blocked_by: removed_by,
            referred_by,
        };
        Some(CommunityEventInternal::UsersBlocked(Box::new(event)))
    } else if removed {
        let event = CommunityMembersRemoved {
            user_ids: vec![user_id],
            removed_by,
            referred_by,
        };
        Some(CommunityEventInternal::MembersRemoved(Box::new(event)))
    } else if invite_removed {
        None
    } else {
        return;
    };

    if let Some(event) = event {
        state.push_community_event(event);
    }

    handle_activity_notification(state);

    if removed {
        // The user's canister is told via the queue of events for users, which keeps them in order and
        // sends them on to the user's new id if they've been migrated to a MultiUser canister. A bot's
        // canister takes no such events.
        if !is_bot {
            state.push_event_to_user(
                user_id,
                CommunityCanisterEvent::RemovedFromCommunity(Box::new(RemovedFromCommunity {
                    removed_by,
                    blocked: block,
                    community_name: state.data.name.value.clone(),
                    public: state.data.is_public.value,
                })),
                now,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_principal::Principal;
    use types::{ChannelId, EventIndex, MessageIndex, UserType};

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
        let owner = new_user_id(1);
        let channel_id = ChannelId::from(1u32);
        let mut data = Data::new_for_tests(
            owner,
            Principal::from_slice(&[1]),
            String::new(),
            vec![(channel_id, "one".to_string())],
        );
        let principal = Principal::from_slice(&[2]);
        data.members.add(old_user_id(2), principal, UserType::User, None, 0);
        data.channels.get_mut(&channel_id).unwrap().chat.members.add(
            old_user_id(2),
            None,
            0,
            EventIndex::default(),
            MessageIndex::default(),
            false,
            UserType::User,
        );
        data.members.mark_member_joined_channel(old_user_id(2), channel_id);

        // An indexed id is the user's latest, whereas an unindexed id the community doesn't know is
        // looked up
        assert_eq!(known_latest_user_id(&data, owner), Some(owner));
        assert_eq!(known_latest_user_id(&data, old_user_id(2)), None);

        // The lookup finds that they have been migrated, so their membership is moved onto their
        // latest id, under which they are then blocked, as `latest_user_id` and `commit` do
        data.migrate_user_ids(&[old_user_id(2)], new_user_id(2), None, 1);
        assert_eq!(known_latest_user_id(&data, old_user_id(2)), Some(new_user_id(2)));
        assert_eq!(data.members.lookup_user_id(principal), Some(new_user_id(2)));
        data.remove_user_from_community(new_user_id(2), None, 2);
        data.members.block(new_user_id(2), 2);

        for user_id in [old_user_id(2), new_user_id(2)] {
            assert!(!data.members.contains(&user_id));
            assert!(!data.channels.get(&channel_id).unwrap().chat.members.contains(&user_id));
        }
        assert_eq!(data.members.blocked(), vec![new_user_id(2)]);
    }
}
