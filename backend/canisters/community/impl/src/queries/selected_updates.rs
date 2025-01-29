use crate::{model::members::CommunityMembers, read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::selected_updates_v2::{Response::*, *};
use group_community_common::{BotUpdate, MemberUpdate};
use std::cell::LazyCell;
use std::collections::HashSet;
use types::{BotGroupDetails, UserId};

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
        bots_added_or_updated: vec![],
        bots_removed: vec![],
        api_keys_generated: data.bot_api_keys.generated_since(args.updates_since),
        blocked_users_added: vec![],
        blocked_users_removed: vec![],
        invited_users,
        chat_rules: data.rules.if_set_after(args.updates_since).map(|r| r.clone().into()),
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

    let member = LazyCell::new(|| data.members.get(*caller));
    for (user_id, update) in state.data.members.iter_latest_updates(args.updates_since) {
        match update {
            MemberUpdate::Added => {
                let referral_added = member.as_ref().is_some_and(|m| m.referrals().contains(&user_id));
                user_updates_handler.mark_member_updated(&mut result, user_id, referral_added, false);
            }
            MemberUpdate::Removed => {
                let referral_removed = member.as_ref().is_some_and(|m| m.referrals_removed().contains(&user_id));
                user_updates_handler.mark_member_updated(&mut result, user_id, referral_removed, true);
            }
            MemberUpdate::RoleChanged => {
                user_updates_handler.mark_member_updated(&mut result, user_id, false, false);
            }
            MemberUpdate::Blocked => {
                user_updates_handler.mark_user_blocked_updated(&mut result, user_id, true);
            }
            MemberUpdate::Unblocked => {
                user_updates_handler.mark_user_blocked_updated(&mut result, user_id, false);
            }
            MemberUpdate::Lapsed | MemberUpdate::Unlapsed | MemberUpdate::DisplayNameChanged => {
                user_updates_handler.mark_member_updated(&mut result, user_id, false, false);
            }
        }
    }

    let mut bots_changed = HashSet::new();
    for (user_id, update) in state.data.bots.iter_latest_updates(args.updates_since) {
        match update {
            BotUpdate::Added | BotUpdate::Updated => {
                if bots_changed.insert(user_id) {
                    if let Some(bot) = state.data.bots.get(&user_id) {
                        result.bots_added_or_updated.push(BotGroupDetails {
                            user_id,
                            permissions: bot.permissions.clone(),
                            added_by: bot.added_by,
                        });
                    }
                }
            }
            BotUpdate::Removed => {
                if bots_changed.insert(user_id) {
                    result.bots_removed.push(user_id);
                }
            }
        }
    }

    Success(result)
}

struct UserUpdatesHandler<'a> {
    members: &'a CommunityMembers,
    users_updated: HashSet<UserId>,
    referrals_updated: HashSet<UserId>,
}

impl UserUpdatesHandler<'_> {
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
