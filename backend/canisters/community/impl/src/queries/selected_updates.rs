use crate::{model::events::CommunityEvent, read_state, Data, RuntimeState};
use community_canister::selected_updates::{Response::*, *};
use ic_cdk_macros::query;
use std::{cmp::max, collections::HashSet};
use types::UserId;

#[query]
fn selected_updates(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let data = &state.data;

    if data.members.get(caller).is_none() {
        return CallerNotInCommunity;
    }

    // Short circuit prior to calling `ic0.time()` so that query caching works effectively.
    let invited_users_last_updated = data.invited_users.last_updated();
    let events_last_updated = data.events.latest_event_timestamp();
    let latest_timestamp = max(events_last_updated, invited_users_last_updated);
    if latest_timestamp <= args.updates_since {
        return SuccessNoUpdates;
    }

    let invited_users = if invited_users_last_updated > args.updates_since {
        Some(data.invited_users.users())
    } else {
        None
    };

    let mut result = SuccessResult {
        timestamp: state.env.now(),
        members_added_or_updated: vec![],
        members_removed: vec![],
        blocked_users_added: vec![],
        blocked_users_removed: vec![],
        invited_users,
        rules: None,
    };

    let mut user_updates_handler = UserUpdatesHandler {
        data,
        users_updated: HashSet::new(),
    };

    // Iterate through the new events starting from most recent
    for event_wrapper in data.events.iter(None, false).take_while(|e| e.timestamp > args.updates_since) {
        match &event_wrapper.event {
            CommunityEvent::MembersRemoved(p) => {
                for user_id in p.user_ids.iter() {
                    user_updates_handler.mark_member_updated(&mut result, *user_id, true);
                }
            }
            CommunityEvent::MemberJoined(p) => {
                user_updates_handler.mark_member_updated(&mut result, p.user_id, false);
            }
            CommunityEvent::MemberLeft(p) => {
                user_updates_handler.mark_member_updated(&mut result, p.user_id, true);
            }
            CommunityEvent::RoleChanged(rc) => {
                for user_id in rc.user_ids.iter() {
                    user_updates_handler.mark_member_updated(&mut result, *user_id, false);
                }
            }
            CommunityEvent::UsersBlocked(ub) => {
                for user_id in ub.user_ids.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, true);
                    user_updates_handler.mark_member_updated(&mut result, *user_id, true);
                }
            }
            CommunityEvent::UsersUnblocked(ub) => {
                for user_id in ub.user_ids.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, false);
                }
            }
            CommunityEvent::RulesChanged(_) => {
                if result.rules.is_none() {
                    result.rules = Some(data.rules.clone());
                }
            }
            _ => {}
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
            } else if let Some(member) = self.data.members.get(user_id.into()) {
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
