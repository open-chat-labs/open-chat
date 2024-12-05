use crate::{
    model::{events::CommunityEventInternal, members::CommunityMembers},
    read_state, RuntimeState,
};
use canister_api_macros::query;
use community_canister::selected_updates_v2::{Response::*, *};
use group_community_common::MemberUpdate;
use std::cell::LazyCell;
use std::collections::HashSet;
use types::UserId;

#[query(candid = true, msgpack = true)]
fn selected_updates_v2(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    // Only call `ic0.caller()` if we have to in order to maximise query caching
    let caller = LazyCell::new(|| state.env.caller());

    if !state.data.is_public.value
        && !state.data.is_invite_code_valid(args.invite_code)
        && !state.data.is_accessible(*caller, None)
    {
        return PrivateCommunity;
    }

    let data = &state.data;
    let last_updated = data.details_last_updated();

    if last_updated <= args.updates_since {
        return SuccessNoUpdates(args.updates_since);
    }

    let invited_users = if data.invited_users.last_updated() > args.updates_since {
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
        referrals_added: vec![],
        referrals_removed: vec![],
    };

    let mut user_updates_handler = UserUpdatesHandler {
        members: &data.members,
        users_updated: HashSet::new(),
        referrals_updated: HashSet::new(),
    };

    let my_user_id = LazyCell::new(|| data.members.get(*caller).map(|m| m.user_id));

    // Iterate through the new events starting from most recent
    for event_wrapper in data.events.iter(None, false).take_while(|e| e.timestamp > args.updates_since) {
        match &event_wrapper.event {
            CommunityEventInternal::MembersRemoved(e) => {
                for user_id in e.user_ids.iter() {
                    let referral = is_my_referral(e.referred_by.get(user_id).copied(), &my_user_id);
                    user_updates_handler.mark_member_updated(&mut result, *user_id, referral, true);
                }
            }
            CommunityEventInternal::MemberJoined(e) => {
                let referral = is_my_referral(e.invited_by, &my_user_id);
                user_updates_handler.mark_member_updated(&mut result, e.user_id, referral, false);
            }
            CommunityEventInternal::MemberLeft(e) => {
                let referral = is_my_referral(e.referred_by, &my_user_id);
                user_updates_handler.mark_member_updated(&mut result, e.user_id, referral, true);
            }
            CommunityEventInternal::RoleChanged(e) => {
                for user_id in e.user_ids.iter() {
                    user_updates_handler.mark_member_updated(&mut result, *user_id, false, false);
                }
            }
            CommunityEventInternal::UsersBlocked(e) => {
                for user_id in e.user_ids.iter() {
                    let referral = is_my_referral(e.referred_by.get(user_id).copied(), &my_user_id);
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, true);
                    user_updates_handler.mark_member_updated(&mut result, *user_id, referral, true);
                }
            }
            CommunityEventInternal::UsersUnblocked(e) => {
                for user_id in e.user_ids.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, false);
                }
            }
            CommunityEventInternal::RulesChanged(_) => {
                if result.chat_rules.is_none() {
                    result.chat_rules = Some(data.rules.value.clone().into());
                }
            }
            CommunityEventInternal::GroupImported(e) => {
                for user_id in e.members_added.iter() {
                    user_updates_handler.mark_member_updated(&mut result, *user_id, false, false);
                }
            }
            _ => {}
        }
    }

    for (user_id, update) in state.data.members.iter_latest_updates(args.updates_since) {
        match update {
            MemberUpdate::Lapsed | MemberUpdate::Unlapsed | MemberUpdate::DisplayNameChanged => {
                user_updates_handler.mark_member_updated(&mut result, user_id, false, false);
            }
            _ => {}
        }
    }

    Success(result)
}

struct UserUpdatesHandler<'a> {
    members: &'a CommunityMembers,
    users_updated: HashSet<UserId>,
    referrals_updated: HashSet<UserId>,
}

impl<'a> UserUpdatesHandler<'a> {
    pub fn mark_member_updated(&mut self, result: &mut SuccessResult, user_id: UserId, referral: bool, removed: bool) {
        if self.users_updated.insert(user_id) {
            if removed {
                result.members_removed.push(user_id);
            } else if let Some(member) = self.members.get_by_user_id(&user_id) {
                result.members_added_or_updated.push(member.into());
            }
        }

        if referral && self.referrals_updated.insert(user_id) {
            if removed {
                result.referrals_removed.push(user_id);
            } else {
                result.referrals_added.push(user_id);
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

fn is_my_referral<F: FnOnce() -> Option<UserId>>(
    referred_by: Option<UserId>,
    my_user_id: &LazyCell<Option<UserId>, F>,
) -> bool {
    if let Some(user_id) = referred_by {
        Some(user_id) == **my_user_id
    } else {
        false
    }
}
