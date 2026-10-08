use std::collections::BTreeSet;
use types::UserId;

// A page of the members of a chat or community
pub struct MembersPage<M> {
    // The members whose details aren't all the defaults, eg. those with a role
    pub members: Vec<M>,
    // The rest of the members
    pub basic_members: Vec<UserId>,
    // The user id to ask for the members after to get the next page, if there are any more
    pub more_members_after: Option<UserId>,
}

// Builds a page holding up to `max_results` (but at least one) of the members in `members_after`,
// or all of them if `max_results` is None. `members_after` is the members who come after the
// previous page, in order of user id.
//
// Those `with_roles` aren't part of that order. They are instead all returned with the first page,
// whatever their user ids, and aren't counted towards `max_results`, so that a client which holds
// only the first page knows every member who has a role.
//
// The pages aren't a snapshot: a member who joins, or is given or loses a role, while a client is
// part way through them can be missed or returned twice. A client puts this right by applying the
// updates since the first page, which it must do in any case to stay up to date.
pub fn members_page<'a, M>(
    with_roles: &[&'a BTreeSet<UserId>],
    members_after: impl Iterator<Item = &'a UserId>,
    first_page: bool,
    max_results: Option<u32>,
    is_basic: impl Fn(&UserId) -> bool,
    full_member: impl Fn(&UserId) -> Option<M>,
) -> MembersPage<M> {
    let mut page = MembersPage {
        members: Vec::new(),
        basic_members: Vec::new(),
        more_members_after: None,
    };
    if first_page {
        page.members
            .extend(with_roles.iter().flat_map(|set| set.iter()).filter_map(&full_member));
    }

    // A page must hold at least one member for there to be a user id to start the next page after
    let max_results = max_results.map(|max| max.max(1));
    let mut count = 0;
    let mut members_after = members_after.filter(|user_id| !with_roles.iter().any(|set| set.contains(user_id)));
    while max_results.is_none_or(|max| count < max)
        && let Some(user_id) = members_after.next()
    {
        if is_basic(user_id) {
            page.basic_members.push(*user_id);
        } else {
            page.members.extend(full_member(user_id));
        }
        count += 1;
        if max_results == Some(count) && members_after.next().is_some() {
            page.more_members_after = Some(*user_id);
        }
    }
    page
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn pages_hold_each_member_once_with_those_with_roles_in_the_first() {
        let page1 = page(&[1, 8], &[3], None, Some(3));
        assert_eq!(page1.members, user_ids([1, 8, 3]));
        assert_eq!(page1.basic_members, user_ids([2, 4]));
        assert_eq!(page1.more_members_after, Some(user_id(4)));

        let page2 = page(&[1, 8], &[3], page1.more_members_after, Some(3));
        assert!(page2.members.is_empty());
        assert_eq!(page2.basic_members, user_ids([5, 6, 7]));
        assert_eq!(page2.more_members_after, Some(user_id(7)));

        // User 8 has already been returned, so isn't again
        let page3 = page(&[1, 8], &[3], page2.more_members_after, Some(3));
        assert!(page3.members.is_empty());
        assert_eq!(page3.basic_members, user_ids([9]));
        assert_eq!(page3.more_members_after, None);
    }

    #[test]
    fn page_which_only_those_with_roles_would_follow_is_the_last() {
        let page = page(&[8, 9], &[], Some(user_id(4)), Some(3));

        assert_eq!(page.basic_members, user_ids([5, 6, 7]));
        assert_eq!(page.more_members_after, None);
    }

    #[test]
    fn page_holds_at_least_one_member() {
        let page = page(&[1], &[], None, Some(0));

        assert_eq!(page.members, user_ids([1]));
        assert_eq!(page.basic_members, user_ids([2]));
        assert_eq!(page.more_members_after, Some(user_id(2)));
    }

    // A page of users 1 to 9, where the full details of a member are just their user id
    fn page(with_roles: &[u8], not_basic: &[u8], after: Option<UserId>, max_results: Option<u32>) -> MembersPage<UserId> {
        let members: BTreeSet<UserId> = (1..=9).map(user_id).collect();
        let with_roles: BTreeSet<UserId> = with_roles.iter().copied().map(user_id).collect();
        let not_basic: BTreeSet<UserId> = not_basic.iter().copied().map(user_id).collect();

        members_page(
            &[&with_roles],
            members.iter().filter(|u| after.is_none_or(|a| **u > a)),
            after.is_none(),
            max_results,
            |u| !not_basic.contains(u),
            |u| Some(*u),
        )
    }

    fn user_ids<const N: usize>(ids: [u8; N]) -> Vec<UserId> {
        ids.map(user_id).to_vec()
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }
}
