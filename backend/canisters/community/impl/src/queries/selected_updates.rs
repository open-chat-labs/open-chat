use crate::{model::events::CommunityEvent, read_state, Data, RuntimeState};
use community_canister::selected_updates::{Response::*, *};
use ic_cdk_macros::query;
use std::collections::HashSet;
use types::UserId;

#[query]
fn selected_updates(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.members.get(caller).is_none() {
        return CallerNotInCommunity;
    }

    // Short circuit prior to calling `ic0.time()` so that query caching works effectively.
    let latest_event_index = state.data.events.latest_event_index();
    if latest_event_index <= args.updates_since {
        return SuccessNoUpdates(latest_event_index);
    }

    let now = state.env.now();
    let data = &state.data;
    let updates_since_time = data.events.get(args.updates_since).map(|e| e.timestamp).unwrap_or_default();

    let invited_users = if data.invited_users.last_updated() > updates_since_time {
        Some(data.invited_users.users())
    } else {
        None
    };

    let mut result = SuccessResult {
        timestamp: now,
        latest_event_index,
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
    for event_wrapper in data.events.iter(None, false).take_while(|e| e.index > args.updates_since) {
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

    if result.members_added_or_updated.is_empty()
        && result.members_removed.is_empty()
        && result.blocked_users_added.is_empty()
        && result.blocked_users_removed.is_empty()
        && result.rules.is_none()
    {
        SuccessNoUpdates(latest_event_index)
    } else {
        Success(result)
    }
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
