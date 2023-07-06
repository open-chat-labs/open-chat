use crate::model::moderation_flags::ModerationFlags;
use crate::model::private_communities::PrivateCommunityInfo;
use crate::MARK_ACTIVE_DURATION;
use search::{Document, Query};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{AccessGate, CommunityId, CommunityMatch, FrozenCommunityInfo, PublicCommunityActivity, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct PublicCommunities {
    communities: HashMap<CommunityId, PublicCommunityInfo>,
}

impl PublicCommunities {
    pub fn len(&self) -> usize {
        self.communities.len()
    }

    pub fn get(&self, community_id: &CommunityId) -> Option<&PublicCommunityInfo> {
        self.communities.get(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut PublicCommunityInfo> {
        self.communities.get_mut(community_id)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn handle_community_created(
        &mut self,
        community_id: CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        banner_id: Option<u128>,
        gate: Option<AccessGate>,
        primary_language: String,
        now: TimestampMillis,
    ) {
        self.communities.insert(
            community_id,
            PublicCommunityInfo::new(
                community_id,
                name,
                description,
                avatar_id,
                banner_id,
                gate,
                primary_language,
                now,
            ),
        );
    }

    pub fn search(
        &self,
        search_term: Option<String>,
        exclude_moderation_flags: ModerationFlags,
        languages: Vec<String>,
        page_index: u32,
        page_size: u8,
    ) -> Vec<CommunityMatch> {
        let query = search_term.map(Query::parse);

        let mut matches: Vec<_> = self
            .iter()
            .filter(|c| !c.is_frozen())
            .filter(|c| !c.moderation_flags().intersects(exclude_moderation_flags))
            .filter(|c| languages.is_empty() || languages.contains(&c.primary_language))
            .map(|c| {
                let score = if let Some(query) = &query {
                    let document: Document = c.into();
                    document.calculate_score(query)
                } else if c.hotness_score > 0 {
                    c.hotness_score
                } else {
                    c.activity.as_ref().map_or(1, |a| a.member_count)
                };
                (score, c)
            })
            .filter(|(score, _)| *score > 0)
            .collect();

        matches.sort_by_key(|(score, _)| *score);

        matches
            .into_iter()
            .rev()
            .map(|(_, c)| c.into())
            .skip(page_index as usize * page_size as usize)
            .take(page_size as usize)
            .collect()
    }

    pub fn update_community(
        &mut self,
        community_id: &CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        banner_id: Option<u128>,
        gate: Option<AccessGate>,
    ) -> UpdateCommunityResult {
        match self.communities.get_mut(community_id) {
            None => UpdateCommunityResult::CommunityNotFound,
            Some(mut community) => {
                community.name = name;
                community.description = description;
                community.avatar_id = avatar_id;
                community.banner_id = banner_id;
                community.gate = gate;
                UpdateCommunityResult::Success
            }
        }
    }

    pub fn delete(&mut self, community_id: &CommunityId) -> Option<PublicCommunityInfo> {
        self.communities.remove(community_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &PublicCommunityInfo> {
        self.communities.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut PublicCommunityInfo> {
        self.communities.values_mut()
    }
}

#[derive(Serialize, Deserialize)]
pub struct PublicCommunityInfo {
    // Fields common to PrivateCommunityInfo
    id: CommunityId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    frozen: Option<FrozenCommunityInfo>,

    // Fields particular to PublicCommunityInfo
    name: String,
    description: String,
    avatar_id: Option<u128>,
    banner_id: Option<u128>,
    activity: Option<PublicCommunityActivity>,
    hotness_score: u32,
    gate: Option<AccessGate>,
    #[serde(default)]
    moderation_flags: ModerationFlags,
    primary_language: String,
}

pub enum UpdateCommunityResult {
    Success,
    CommunityNotFound,
}

impl PublicCommunityInfo {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        banner_id: Option<u128>,
        gate: Option<AccessGate>,
        primary_language: String,
        now: TimestampMillis,
    ) -> PublicCommunityInfo {
        PublicCommunityInfo {
            id,
            name,
            description,
            avatar_id,
            banner_id,
            gate,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            activity: None,
            hotness_score: 0,
            frozen: None,
            moderation_flags: ModerationFlags::default(),
            primary_language,
        }
    }

    pub fn id(&self) -> CommunityId {
        self.id
    }

    pub fn name(&self) -> &str {
        self.name.as_str()
    }

    pub fn created(&self) -> TimestampMillis {
        self.created
    }

    pub fn marked_active_until(&self) -> TimestampMillis {
        self.marked_active_until
    }

    pub fn activity(&self) -> &Option<PublicCommunityActivity> {
        &self.activity
    }

    pub fn mark_active(&mut self, until: TimestampMillis, activity: PublicCommunityActivity) {
        self.marked_active_until = until;
        self.activity = Some(activity);
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn frozen_info(&self) -> Option<&FrozenCommunityInfo> {
        self.frozen.as_ref()
    }

    pub fn set_frozen(&mut self, info: Option<FrozenCommunityInfo>) {
        self.frozen = info;
    }

    pub fn set_hotness_score(&mut self, hotness_score: u32) {
        self.hotness_score = hotness_score;
    }

    pub fn moderation_flags(&self) -> &ModerationFlags {
        &self.moderation_flags
    }

    pub fn set_moderation_flags(&mut self, flags: ModerationFlags) {
        self.moderation_flags = flags;
    }
}

impl From<&PublicCommunityInfo> for CommunityMatch {
    fn from(community: &PublicCommunityInfo) -> Self {
        CommunityMatch {
            id: community.id,
            name: community.name.clone(),
            description: community.description.clone(),
            avatar_id: community.avatar_id,
            banner_id: community.banner_id,
            member_count: community.activity.as_ref().map_or(0, |a| a.member_count),
            channel_count: community.activity.as_ref().map_or(0, |a| a.channel_count),
            gate: community.gate.clone(),
            moderation_flags: community.moderation_flags.bits(),
        }
    }
}

impl From<&PublicCommunityInfo> for Document {
    fn from(community: &PublicCommunityInfo) -> Self {
        let mut document = Document::default();
        document
            .add_field(community.name.clone(), 5.0, true)
            .add_field(community.description.clone(), 1.0, true);
        document
    }
}

impl From<PublicCommunityInfo> for PrivateCommunityInfo {
    fn from(public_community_info: PublicCommunityInfo) -> Self {
        let mut private_community_info = PrivateCommunityInfo::new(public_community_info.id, public_community_info.created);
        private_community_info.mark_active(public_community_info.marked_active_until);
        private_community_info.set_frozen(public_community_info.frozen);
        private_community_info
    }
}
