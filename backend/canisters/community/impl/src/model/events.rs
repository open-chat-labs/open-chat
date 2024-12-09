use crate::model::events::stable_memory::EventsStableStorage;
use chat_events::GroupGateUpdatedInternal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tracing::info;
use types::{
    AvatarChanged, BannerChanged, BotAdded, BotRemoved, BotUpdated, ChannelDeleted, ChannelId, ChatId,
    CommunityMemberLeftInternal, CommunityMembersRemoved, CommunityPermissionsChanged, CommunityRoleChanged,
    CommunityUsersBlocked, CommunityVisibilityChanged, DefaultChannelsChanged, EventIndex, EventWrapperInternal, GroupCreated,
    GroupDescriptionChanged, GroupFrozen, GroupInviteCodeChanged, GroupNameChanged, GroupRulesChanged, GroupUnfrozen,
    MemberJoinedInternal, PrimaryLanguageChanged, TimestampMillis, UserId, UsersInvited, UsersUnblocked,
};

mod stable_memory;

#[derive(Serialize, Deserialize)]
#[serde(from = "CommunityEventsPrevious")]
pub struct CommunityEvents {
    events_map: BTreeMap<EventIndex, EventWrapperInternal<CommunityEventInternal>>,
    stable_events_map: EventsStableStorage,
    latest_event_index: EventIndex,
    latest_event_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize)]
pub struct CommunityEventsPrevious {
    events_map: BTreeMap<EventIndex, EventWrapperInternal<CommunityEventInternalOld>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CommunityEventInternalOld {
    #[serde(rename = "cr", alias = "Created")]
    Created(Box<GroupCreated>),
    #[serde(rename = "nc", alias = "NameChanged")]
    NameChanged(Box<GroupNameChanged>),
    #[serde(rename = "dc", alias = "DescriptionChanged")]
    DescriptionChanged(Box<GroupDescriptionChanged>),
    #[serde(rename = "rc", alias = "RulesChanged")]
    RulesChanged(Box<GroupRulesChanged>),
    #[serde(rename = "ac", alias = "AvatarChanged")]
    AvatarChanged(Box<AvatarChanged>),
    #[serde(rename = "bc", alias = "BannerChanged")]
    BannerChanged(Box<BannerChanged>),
    #[serde(rename = "ui", alias = "UsersInvited")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "mj", alias = "MemberJoined")]
    MemberJoined(Box<MemberJoinedInternal>),
    #[serde(rename = "mr", alias = "MembersRemoved")]
    MembersRemoved(Box<CommunityMembersRemoved>),
    #[serde(rename = "ml", alias = "MemberLeft")]
    MemberLeft(Box<CommunityMemberLeftInternal>),
    #[serde(rename = "rc", alias = "RoleChanged")]
    RoleChanged(Box<CommunityRoleChanged>),
    #[serde(rename = "ub", alias = "UsersBlocked")]
    UsersBlocked(Box<CommunityUsersBlocked>),
    #[serde(rename = "uu", alias = "UsersUnblocked")]
    UsersUnblocked(Box<UsersUnblocked>),
    #[serde(rename = "pc", alias = "PermissionsChanged")]
    PermissionsChanged(Box<CommunityPermissionsChanged>),
    #[serde(rename = "vc", alias = "VisibilityChanged")]
    VisibilityChanged(Box<CommunityVisibilityChanged>),
    #[serde(rename = "ic", alias = "InviteCodeChanged")]
    InviteCodeChanged(Box<GroupInviteCodeChanged>),
    #[serde(rename = "fr", alias = "Frozen")]
    Frozen(Box<GroupFrozen>),
    #[serde(rename = "uf", alias = "Unfrozen")]
    Unfrozen(Box<GroupUnfrozen>),
    #[serde(rename = "gu", alias = "GateUpdated")]
    GateUpdated(Box<GroupGateUpdatedInternal>),
    #[serde(rename = "cd", alias = "ChannelDeleted")]
    ChannelDeleted(Box<ChannelDeleted>),
    #[serde(rename = "dcc", alias = "DefaultChannelsChanged")]
    DefaultChannelsChanged(Box<DefaultChannelsChanged>),
    #[serde(rename = "pl", alias = "PrimaryLanguageChanged")]
    PrimaryLanguageChanged(Box<PrimaryLanguageChanged>),
    #[serde(rename = "gi", alias = "GroupImported")]
    GroupImported(Box<GroupImportedInternal>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CommunityEventInternal {
    #[serde(rename = "cr", alias = "Created")]
    Created(Box<GroupCreated>),
    #[serde(rename = "nc", alias = "NameChanged")]
    NameChanged(Box<GroupNameChanged>),
    #[serde(rename = "dc", alias = "DescriptionChanged")]
    DescriptionChanged(Box<GroupDescriptionChanged>),
    #[serde(rename = "rc", alias = "RulesChanged")]
    RulesChanged(Box<GroupRulesChanged>),
    #[serde(rename = "ac", alias = "AvatarChanged")]
    AvatarChanged(Box<AvatarChanged>),
    #[serde(rename = "bc", alias = "BannerChanged")]
    BannerChanged(Box<BannerChanged>),
    #[serde(rename = "ui", alias = "UsersInvited")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "mr", alias = "MembersRemoved")]
    MembersRemoved(Box<CommunityMembersRemoved>),
    #[serde(rename = "rc", alias = "RoleChanged")]
    RoleChanged(Box<CommunityRoleChanged>),
    #[serde(rename = "ub", alias = "UsersBlocked")]
    UsersBlocked(Box<CommunityUsersBlocked>),
    #[serde(rename = "uu", alias = "UsersUnblocked")]
    UsersUnblocked(Box<UsersUnblocked>),
    #[serde(rename = "pc", alias = "PermissionsChanged")]
    PermissionsChanged(Box<CommunityPermissionsChanged>),
    #[serde(rename = "vc", alias = "VisibilityChanged")]
    VisibilityChanged(Box<CommunityVisibilityChanged>),
    #[serde(rename = "ic", alias = "InviteCodeChanged")]
    InviteCodeChanged(Box<GroupInviteCodeChanged>),
    #[serde(rename = "fr", alias = "Frozen")]
    Frozen(Box<GroupFrozen>),
    #[serde(rename = "uf", alias = "Unfrozen")]
    Unfrozen(Box<GroupUnfrozen>),
    #[serde(rename = "gu", alias = "GateUpdated")]
    GateUpdated(Box<GroupGateUpdatedInternal>),
    #[serde(rename = "cd", alias = "ChannelDeleted")]
    ChannelDeleted(Box<ChannelDeleted>),
    #[serde(rename = "pl", alias = "PrimaryLanguageChanged")]
    PrimaryLanguageChanged(Box<PrimaryLanguageChanged>),
    #[serde(rename = "gi", alias = "GroupImported")]
    GroupImported(Box<GroupImportedInternal>),
    #[serde(rename = "ba")]
    BotAdded(Box<BotAdded>),
    #[serde(rename = "br")]
    BotRemoved(Box<BotRemoved>),
    #[serde(rename = "bu")]
    BotUpdated(Box<BotUpdated>),
}

impl CommunityEvents {
    pub fn migrate_to_stable_memory(&mut self) {
        for event in self.events_map.values() {
            self.stable_events_map.insert(event.clone());
        }
        let count = self.events_map.len();
        info!(count, "Community events migrated to stable memory");
    }

    pub fn new(name: String, description: String, created_by: UserId, now: TimestampMillis) -> CommunityEvents {
        let event_index = EventIndex::default();
        let event = EventWrapperInternal {
            index: event_index,
            timestamp: now,
            correlation_id: 0,
            expires_at: None,
            event: CommunityEventInternal::Created(Box::new(GroupCreated {
                name,
                description,
                created_by,
            })),
        };

        let mut events_map = BTreeMap::new();
        events_map.insert(event_index, event.clone());
        let mut stable_events_map = EventsStableStorage::default();
        stable_events_map.insert(event);

        CommunityEvents {
            events_map,
            stable_events_map,
            latest_event_index: event_index,
            latest_event_timestamp: now,
        }
    }

    pub(crate) fn push_event(&mut self, event: CommunityEventInternal, now: TimestampMillis) -> EventIndex {
        let event_index = self.next_event_index();
        let event = EventWrapperInternal {
            index: event_index,
            timestamp: now,
            correlation_id: 0,
            expires_at: None,
            event,
        };

        self.events_map.insert(event_index, event.clone());
        self.stable_events_map.insert(event);

        self.latest_event_index = event_index;
        self.latest_event_timestamp = now;

        event_index
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.latest_event_index.incr()
    }

    pub fn latest_event_index(&self) -> EventIndex {
        self.latest_event_index
    }

    pub fn latest_event_timestamp(&self) -> TimestampMillis {
        self.latest_event_timestamp
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupImportedInternal {
    pub group_id: ChatId,
    pub channel_id: ChannelId,
    pub members_added: Vec<UserId>,
}

impl TryFrom<CommunityEventInternalOld> for CommunityEventInternal {
    type Error = ();

    fn try_from(value: CommunityEventInternalOld) -> Result<Self, Self::Error> {
        match value {
            CommunityEventInternalOld::Created(e) => Ok(CommunityEventInternal::Created(e)),
            CommunityEventInternalOld::NameChanged(e) => Ok(CommunityEventInternal::NameChanged(e)),
            CommunityEventInternalOld::DescriptionChanged(e) => Ok(CommunityEventInternal::DescriptionChanged(e)),
            CommunityEventInternalOld::RulesChanged(e) => Ok(CommunityEventInternal::RulesChanged(e)),
            CommunityEventInternalOld::AvatarChanged(e) => Ok(CommunityEventInternal::AvatarChanged(e)),
            CommunityEventInternalOld::BannerChanged(e) => Ok(CommunityEventInternal::BannerChanged(e)),
            CommunityEventInternalOld::UsersInvited(e) => Ok(CommunityEventInternal::UsersInvited(e)),
            CommunityEventInternalOld::MembersRemoved(e) => Ok(CommunityEventInternal::MembersRemoved(e)),
            CommunityEventInternalOld::RoleChanged(e) => Ok(CommunityEventInternal::RoleChanged(e)),
            CommunityEventInternalOld::UsersBlocked(e) => Ok(CommunityEventInternal::UsersBlocked(e)),
            CommunityEventInternalOld::UsersUnblocked(e) => Ok(CommunityEventInternal::UsersUnblocked(e)),
            CommunityEventInternalOld::PermissionsChanged(e) => Ok(CommunityEventInternal::PermissionsChanged(e)),
            CommunityEventInternalOld::VisibilityChanged(e) => Ok(CommunityEventInternal::VisibilityChanged(e)),
            CommunityEventInternalOld::InviteCodeChanged(e) => Ok(CommunityEventInternal::InviteCodeChanged(e)),
            CommunityEventInternalOld::Frozen(e) => Ok(CommunityEventInternal::Frozen(e)),
            CommunityEventInternalOld::Unfrozen(e) => Ok(CommunityEventInternal::Unfrozen(e)),
            CommunityEventInternalOld::GateUpdated(e) => Ok(CommunityEventInternal::GateUpdated(e)),
            CommunityEventInternalOld::ChannelDeleted(e) => Ok(CommunityEventInternal::ChannelDeleted(e)),
            CommunityEventInternalOld::PrimaryLanguageChanged(e) => Ok(CommunityEventInternal::PrimaryLanguageChanged(e)),
            CommunityEventInternalOld::GroupImported(e) => Ok(CommunityEventInternal::GroupImported(e)),
            CommunityEventInternalOld::MemberJoined(_)
            | CommunityEventInternalOld::MemberLeft(_)
            | CommunityEventInternalOld::DefaultChannelsChanged(_) => Err(()),
        }
    }
}

impl From<CommunityEventsPrevious> for CommunityEvents {
    fn from(value: CommunityEventsPrevious) -> Self {
        let mut events_map = BTreeMap::new();
        let mut index = EventIndex::default();
        for old_event in value.events_map.into_values() {
            if let Ok(new_event) = CommunityEventInternal::try_from(old_event.event) {
                events_map.insert(
                    index,
                    EventWrapperInternal {
                        index,
                        timestamp: old_event.timestamp,
                        correlation_id: 0,
                        expires_at: None,
                        event: new_event,
                    },
                );
                index = index.incr();
            }
        }

        let last = events_map.values().last().unwrap();
        let latest_event_index = last.index;
        let latest_event_timestamp = last.timestamp;

        CommunityEvents {
            events_map,
            stable_events_map: EventsStableStorage::default(),
            latest_event_index,
            latest_event_timestamp,
        }
    }
}
