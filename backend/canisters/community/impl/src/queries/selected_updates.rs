use crate::{model::events::CommunityEventInternal, read_state, Data, RuntimeState};
use community_canister::selected_updates_v2::{Response::*, *};
use ic_cdk::query;
use std::collections::HashSet;
use types::UserId;

#[query]
fn selected_updates(args: Args) -> community_canister::selected_updates::Response {
    read_state(|state| selected_updates_impl(args, state)).into()
}

#[query]
fn selected_updates_v2(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    // Don't call `ic0.caller()` if the community is public or the invite_code is valid to maximise query caching
    if !state.data.is_public || !state.data.is_invite_code_valid(args.invite_code) {
        let caller = state.env.caller();
        if !state.data.is_accessible(caller, None) {
            return PrivateCommunity;
        }
    }

    let data = &state.data;
    let last_updated = data.details_last_updated();

    if last_updated <= args.updates_since {
        return SuccessNoUpdates(args.updates_since);
    }

    let invited_users = if state.data.invited_users.last_updated() > args.updates_since {
        Some(data.invited_users.users())
    } else {
        None
    };

    let mut result = SuccessResult {
        timestamp: last_updated,
        last_updated,
        members_added_or_updated: vec![],
        members_removed: vec![],
        blocked_users_added: vec![],
        blocked_users_removed: vec![],
        invited_users,
        chat_rules: None,
        user_groups: data
            .members
            .iter_user_groups()
            .filter(|u| u.last_updated() > args.updates_since)
            .map(|u| u.into())
            .collect(),
        user_groups_deleted: data.members.user_groups_deleted_since(args.updates_since),
    };

    let mut user_updates_handler = UserUpdatesHandler {
        data,
        users_updated: HashSet::new(),
    };

    // Iterate through the new events starting from most recent
    for event_wrapper in data.events.iter(None, false).take_while(|e| e.timestamp > args.updates_since) {
        match &event_wrapper.event {
            CommunityEventInternal::MembersRemoved(p) => {
                for user_id in p.user_ids.iter() {
                    user_updates_handler.mark_member_updated(&mut result, *user_id, true);
                }
            }
            CommunityEventInternal::MemberJoined(p) => {
                user_updates_handler.mark_member_updated(&mut result, p.user_id, false);
            }
            CommunityEventInternal::MemberLeft(p) => {
                user_updates_handler.mark_member_updated(&mut result, p.user_id, true);
            }
            CommunityEventInternal::RoleChanged(rc) => {
                for user_id in rc.user_ids.iter() {
                    user_updates_handler.mark_member_updated(&mut result, *user_id, false);
                }
            }
            CommunityEventInternal::UsersBlocked(ub) => {
                for user_id in ub.user_ids.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, true);
                    user_updates_handler.mark_member_updated(&mut result, *user_id, true);
                }
            }
            CommunityEventInternal::UsersUnblocked(ub) => {
                for user_id in ub.user_ids.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, false);
                }
            }
            CommunityEventInternal::RulesChanged(_) => {
                if result.chat_rules.is_none() {
                    result.chat_rules = Some(data.rules.clone().into());
                }
            }
            CommunityEventInternal::GroupImported(g) => {
                for user_id in g.members_added.iter() {
                    user_updates_handler.mark_member_updated(&mut result, *user_id, false);
                }
            }
            _ => {}
        }
    }

    for member in data.members.iter() {
        if member.display_name().timestamp > args.updates_since {
            user_updates_handler.mark_member_updated(&mut result, member.user_id, false);
        }
    }

    Success(result)
}

struct UserUpdatesHandler<'a> {
    data: &'a Data,
    users_updated: HashSet<UserId>,
}

impl<'a> UserUpdatesHandler<'a> {
    pub fn mark_member_updated(&mut self, result: &mut SuccessResult, user_id: UserId, removed: bool) {
        if self.users_updated.insert(user_id) {
            if removed {
                result.members_removed.push(user_id);
            } else if let Some(member) = self.data.members.get_by_user_id(&user_id) {
                result.members_added_or_updated.push(member.into());
            }
        }
    }

    pub fn mark_user_blocked_updated(&mut self, result: &mut SuccessResult, user_id: UserId, blocked: bool) {
        if self.users_updated.insert(user_id) {
            if blocked {
                result.members_removed.push(user_id);
                result.blocked_users_added.push(user_id);
            } else {
                result.blocked_users_removed.push(user_id);
            }
        }
    }
}
