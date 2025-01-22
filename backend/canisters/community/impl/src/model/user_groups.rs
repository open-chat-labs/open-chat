use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{BTreeMap, HashSet};
use types::{TimestampMillis, Timestamped, UserGroupDetails, UserGroupSummary, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserGroups {
    groups: Vec<UserGroup>,
    deleted: BTreeMap<TimestampMillis, Vec<u32>>,
    last_updated: TimestampMillis,
}

impl UserGroups {
    pub fn create<R: RngCore>(&mut self, name: String, users: Vec<UserId>, rng: &mut R, now: TimestampMillis) -> Option<u32> {
        if self.groups.iter().any(|g| g.name.eq_ignore_ascii_case(&name)) {
            None
        } else {
            let id = self.generate_id(rng);

            self.groups.push(UserGroup {
                id,
                name: Timestamped::new(name, now),
                members: Timestamped::new(HashSet::from_iter(users), now),
            });
            self.last_updated = now;

            Some(id)
        }
    }

    pub fn update(
        &mut self,
        id: u32,
        name: Option<String>,
        users_to_add: Vec<UserId>,
        users_to_remove: Vec<UserId>,
        now: TimestampMillis,
    ) -> bool {
        if let Some(group) = self.groups.iter_mut().find(|g| g.id == id) {
            if let Some(name) = name {
                group.name = Timestamped::new(name, now);
            }

            if !users_to_add.is_empty() || !users_to_remove.is_empty() {
                for user_id in users_to_remove {
                    group.members.value.remove(&user_id);
                }
                group.members.value.extend(users_to_add);
                group.members.timestamp = now;
            }
            self.last_updated = now;
            true
        } else {
            false
        }
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

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn deleted_since(&self, since: TimestampMillis) -> Vec<u32> {
        self.deleted
            .iter()
            .rev()
            .take_while(|(&k, _)| k > since)
            .flat_map(|(_, v)| v)
            .copied()
            .collect()
    }

    fn generate_id<R: RngCore>(&self, rng: &mut R) -> u32 {
        let ids: HashSet<_> = self.groups.iter().map(|g| g.id).collect();

        loop {
            let id = rng.next_u32();
            if !ids.contains(&id) {
                return id;
            }
        }
    }
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
