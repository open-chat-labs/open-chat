use crate::{model::events::CommunityEvent, mutate_state, Data, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use community_canister::c2c_delete_group::{Response::*, *};
use ic_cdk_macros::update;
use types::{CommunityGroupId, GroupDeleted, TimestampMillis, UserId};

#[update]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| c2c_delete_group_impl(args.group_id, state))
}

fn c2c_delete_group_impl(group_id: CommunityGroupId, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();

    let response = can_delete_group(group_id, caller, &state.data);

    if matches!(response, Success) {
        delete_group(group_id, caller.into(), now, &mut state.data);
    }

    Success
}

fn can_delete_group(group_id: CommunityGroupId, caller: Principal, data: &Data) -> Response {
    if data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(member) = data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(group) = data.groups.get(&group_id) {
            let sender = member.user_id;
            if let Some(group_member) = group.members.get(&sender) {
                if group_member.role.can_delete_group() {
                    Success
                } else {
                    NotAuthorized
                }
            } else {
                UserNotInGroup
            }
        } else {
            GroupNotFound
        }
    } else {
        CallerNotInCommunity
    }
}

fn delete_group(group_id: CommunityGroupId, deleted_by: UserId, now: TimestampMillis, data: &mut Data) {
    let group = data.groups.delete(group_id).expect("Group should exist");

    data.events.push_event(
        CommunityEvent::GroupDeleted(Box::new(GroupDeleted {
            group_id,
            name: group.name,
            deleted_by,
        })),
        now,
    );
}
