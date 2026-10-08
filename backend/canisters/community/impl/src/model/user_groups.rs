use oc_error_codes::{OCError, OCErrorCode};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{BTreeMap, HashSet};
use types::{OCResult, TimestampMillis, Timestamped, UserGroupDetails, UserGroupSummary, UserId};

// Each member of a user group is notified, and has the mention recorded against them in stable
// memory, whenever the user group is mentioned, so this bounds the work done by a single message
pub const MAX_USER_GROUP_MEMBERS: u32 = 1000;

#[derive(Serialize, Deserialize, Default)]
pub struct UserGroups {
    groups: Vec<UserGroup>,
    deleted: BTreeMap<TimestampMillis, Vec<u32>>,
    last_updated: TimestampMillis,
}

impl UserGroups {
    pub fn create<R: Rng>(&mut self, name: String, users: Vec<UserId>, rng: &mut R, now: TimestampMillis) -> OCResult<u32> {
        if self.groups.iter().any(|g| g.name.eq_ignore_ascii_case(&name)) {
            return Err(OCErrorCode::NameTaken.into());
        }

        let members = HashSet::from_iter(users);
        if members.len() > MAX_USER_GROUP_MEMBERS as usize {
            return Err(too_many_members());
        }

        let id = self.generate_id(rng);

        self.groups.push(UserGroup {
            id,
            name: Timestamped::new(name, now),
            members: Timestamped::new(members, now),
        });
        self.last_updated = now;

        Ok(id)
    }

    pub fn update(
        &mut self,
        id: u32,
        name: Option<String>,
        users_to_add: Vec<UserId>,
        users_to_remove: Vec<UserId>,
        now: TimestampMillis,
    ) -> OCResult {
        let Some(group) = self.groups.iter_mut().find(|g| g.id == id) else {
            return Err(OCErrorCode::UserGroupNotFound.into());
        };

        if !users_to_add.is_empty() || !users_to_remove.is_empty() {
            let mut members = group.members.value.clone();
            for user_id in users_to_remove {
                members.remove(&user_id);
            }
            members.extend(users_to_add);

            // A user group which was already over the limit when the limit was introduced can still
            // be updated, so long as it doesn't grow
            if members.len() > MAX_USER_GROUP_MEMBERS as usize && members.len() > group.members.value.len() {
                return Err(too_many_members());
            }
            group.members = Timestamped::new(members, now);
        }

        if let Some(name) = name {
            group.name = Timestamped::new(name, now);
        }
        self.last_updated = now;
        Ok(())
    }

    pub fn delete(&mut self, user_group_id: u32, now: TimestampMillis) -> bool {
        let original_len = self.groups.len();
        self.groups.retain(|ug| ug.id != user_group_id);

        if self.groups.len() != original_len {
            self.deleted.entry(now).or_default().push(user_group_id);
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn get(&self, user_group_id: u32) -> Option<&UserGroup> {
        self.groups.iter().find(|g| g.id == user_group_id)
    }
    pub fn iter(&self) -> impl Iterator<Item = &UserGroup> {
        self.groups.iter()
    }

    pub fn remove_user_from_all(&mut self, user_id: &UserId, now: TimestampMillis) {
        for group in self.groups.iter_mut() {
            if group.members.update(|u| u.remove(user_id), now) {
                self.last_updated = now;
            }
        }
    }

    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) {
        for group in self.groups.iter_mut() {
            if group.members.update(
                |u| {
                    if u.remove(&old_user_id) {
                        u.insert(new_user_id);
                        true
                    } else {
                        false
                    }
                },
                now,
            ) {
                self.last_updated = now;
            }
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn deleted_since(&self, since: TimestampMillis) -> Vec<u32> {
        self.deleted
            .iter()
            .rev()
            .take_while(|(k, _)| **k > since)
            .flat_map(|(_, v)| v)
            .copied()
            .collect()
    }

    fn generate_id<R: Rng>(&self, rng: &mut R) -> u32 {
        let ids: HashSet<_> = self.groups.iter().map(|g| g.id).collect();

        loop {
            let id = rng.next_u32();
            if !ids.contains(&id) {
                return id;
            }
        }
    }
}

// The limit is sent as the error's message, which the website shows to the user
fn too_many_members() -> OCError {
    OCErrorCode::TooManyUsers.with_message(MAX_USER_GROUP_MEMBERS)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UserGroup {
    pub id: u32,
    pub name: Timestamped<String>,
    pub members: Timestamped<HashSet<UserId>>,
}

impl UserGroup {
    pub fn last_updated(&self) -> TimestampMillis {
        max(self.name.timestamp, self.members.timestamp)
    }
}

impl From<&UserGroup> for UserGroupSummary {
    fn from(value: &UserGroup) -> Self {
        UserGroupSummary {
            user_group_id: value.id,
            name: value.name.value.clone(),
            members: value.members.len() as u32,
        }
    }
}

impl From<&UserGroup> for UserGroupDetails {
    fn from(value: &UserGroup) -> Self {
        UserGroupDetails {
            user_group_id: value.id,
            name: value.name.value.clone(),
            members: value.members.iter().copied().collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    const MAX: u32 = MAX_USER_GROUP_MEMBERS;

    #[test]
    fn user_group_can_be_created_with_the_maximum_members_but_no_more() {
        let mut user_groups = UserGroups::default();

        let error = user_groups
            .create("a".to_string(), users(0..MAX + 1), &mut rand::rng(), 1)
            .unwrap_err();
        assert_too_many_members(&error);
        assert!(user_groups.iter().next().is_none());

        let id = create(&mut user_groups, "a", users(0..MAX));
        assert_eq!(member_count(&user_groups, id), MAX);
    }

    #[test]
    fn user_group_cannot_be_created_with_a_name_which_is_taken() {
        let mut user_groups = UserGroups::default();
        create(&mut user_groups, "a", users(0..1));

        let error = user_groups
            .create("A".to_string(), users(0..1), &mut rand::rng(), 2)
            .unwrap_err();
        assert!(error.matches_code(OCErrorCode::NameTaken));
    }

    #[test]
    fn user_group_cannot_be_updated_to_have_more_than_the_maximum_members() {
        let mut user_groups = UserGroups::default();
        let id = create(&mut user_groups, "a", users(0..MAX - 1));

        // Nothing is changed by an update which would take the user group over the limit
        let error = user_groups
            .update(id, Some("b".to_string()), users(MAX - 1..MAX + 1), Vec::new(), 2)
            .unwrap_err();
        assert_too_many_members(&error);
        assert_eq!(member_count(&user_groups, id), MAX - 1);
        assert_eq!(user_groups.get(id).unwrap().name.value, "a");
        assert_eq!(user_groups.last_updated(), 1);

        // Users who are being removed make room for those who are being added
        user_groups.update(id, None, users(MAX - 1..MAX + 1), users(0..1), 3).unwrap();
        assert_eq!(member_count(&user_groups, id), MAX);

        // Users who are already members don't count again
        user_groups.update(id, None, users(1..MAX + 1), Vec::new(), 4).unwrap();
        assert_eq!(member_count(&user_groups, id), MAX);
    }

    #[test]
    fn user_group_already_over_the_maximum_can_be_updated_so_long_as_it_does_not_grow() {
        let mut user_groups = UserGroups::default();
        let id = create(&mut user_groups, "a", users(0..MAX));
        // Make the user group larger than can now be created, as it could be before there was a limit
        user_groups.groups[0].members.value.extend(users(MAX..MAX + 10));

        let error = user_groups
            .update(id, None, users(MAX + 10..MAX + 11), Vec::new(), 2)
            .unwrap_err();
        assert_too_many_members(&error);

        user_groups
            .update(id, Some("b".to_string()), Vec::new(), Vec::new(), 3)
            .unwrap();
        user_groups
            .update(id, None, users(MAX + 10..MAX + 11), users(0..1), 4)
            .unwrap();
        user_groups.update(id, None, Vec::new(), users(1..2), 5).unwrap();
        assert_eq!(member_count(&user_groups, id), MAX + 9);
    }

    // The website shows the error's message to the user as the limit
    fn assert_too_many_members(error: &OCError) {
        assert!(error.matches_code(OCErrorCode::TooManyUsers));
        assert_eq!(error.message(), Some("1000"));
    }

    fn create(user_groups: &mut UserGroups, name: &str, users: Vec<UserId>) -> u32 {
        user_groups.create(name.to_string(), users, &mut rand::rng(), 1).unwrap()
    }

    fn member_count(user_groups: &UserGroups, id: u32) -> u32 {
        user_groups.get(id).unwrap().members.value.len() as u32
    }

    fn users(range: std::ops::Range<u32>) -> Vec<UserId> {
        range.map(|i| Principal::from_slice(&i.to_be_bytes()).into()).collect()
    }
}
