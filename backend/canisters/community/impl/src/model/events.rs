use crate::model::events::stable_memory::EventsStableStorage;
use chat_events::GroupGateUpdatedInternal;
use serde::{Deserialize, Serialize};
use tracing::info;
use types::{
    AvatarChanged, BannerChanged, BotAdded, BotRemoved, BotUpdated, ChannelDeleted, ChannelId, ChatId, CommunityMembersRemoved,
    CommunityPermissionsChanged, CommunityRole, CommunityUsersBlocked, CommunityVisibilityChanged, EventIndex,
    EventWrapperInternal, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupInviteCodeChanged, GroupNameChanged,
    GroupUnfrozen, PrimaryLanguageChanged, TimestampMillis, UserId, UsersInvited, UsersUnblocked,
};
use user_canister::token_swap_status::CandidType;

mod stable_memory;

#[derive(Serialize, Deserialize)]
pub struct CommunityEvents {
    stable_events_map: EventsStableStorage,
    latest_event_index: EventIndex,
    latest_event_timestamp: TimestampMillis,
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
    RulesChangedOrRoleChanged(Box<RulesChangedOrRoleChanged>),
    #[serde(rename = "ac", alias = "AvatarChanged")]
    AvatarChanged(Box<AvatarChanged>),
    #[serde(rename = "bc", alias = "BannerChanged")]
    BannerChanged(Box<BannerChanged>),
    #[serde(rename = "ui", alias = "UsersInvited")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "mr", alias = "MembersRemoved")]
    MembersRemoved(Box<CommunityMembersRemoved>),
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CommunityEventInternal {
    #[serde(rename = "cr", alias = "Created")]
    Created(Box<GroupCreated>),
    #[serde(rename = "nc", alias = "NameChanged")]
    NameChanged(Box<GroupNameChanged>),
    #[serde(rename = "dc", alias = "DescriptionChanged")]
    DescriptionChanged(Box<GroupDescriptionChanged>),
    #[serde(rename = "rc", alias = "RulesChanged")]
    RulesChanged(Box<types::GroupRulesChanged>),
    #[serde(rename = "ac", alias = "AvatarChanged")]
    AvatarChanged(Box<AvatarChanged>),
    #[serde(rename = "bc", alias = "BannerChanged")]
    BannerChanged(Box<BannerChanged>),
    #[serde(rename = "ui", alias = "UsersInvited")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "mr", alias = "MembersRemoved")]
    MembersRemoved(Box<CommunityMembersRemoved>),
    #[serde(rename = "rl", alias = "RoleChanged")]
    RoleChanged(Box<types::CommunityRoleChanged>),
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(untagged)]
pub enum RulesChangedOrRoleChanged {
    RulesChanged(GroupRulesChanged),
    RoleChanged(CommunityRoleChanged),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupRulesChanged {
    pub enabled: bool,
    pub prev_enabled: bool,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityRoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: CommunityRole,
    pub new_role: CommunityRole,
}

impl CommunityEvents {
    pub fn fix_role_changed_events(&mut self) {
        let mut count_updated = 0;
        for event_wrapper in self.stable_events_map.read_all() {
            if let CommunityEventInternalOld::RulesChangedOrRoleChanged(r) = event_wrapper.event {
                if let RulesChangedOrRoleChanged::RoleChanged(role) = *r {
                    self.stable_events_map.insert(EventWrapperInternal {
                        index: event_wrapper.index,
                        timestamp: event_wrapper.timestamp,
                        correlation_id: 0,
                        expires_at: event_wrapper.expires_at,
                        event: CommunityEventInternal::RoleChanged(Box::new(types::CommunityRoleChanged {
                            user_ids: role.user_ids,
                            changed_by: role.changed_by,
                            old_role: role.old_role,
                            new_role: role.new_role,
                        })),
                    });
                    count_updated += 1;
                }
            }
        }
        info!(count_updated, "Fixed community events");
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

        let mut stable_events_map = EventsStableStorage::default();
        stable_events_map.insert(event);

        CommunityEvents {
            stable_events_map,
            latest_event_index: event_index,
            latest_event_timestamp: now,
        }
    }

    pub(crate) fn push_event(&mut self, event: CommunityEventInternal, now: TimestampMillis) -> EventIndex {
        let event_index = self.next_event_index();
        self.stable_events_map.insert(EventWrapperInternal {
            index: event_index,
            timestamp: now,
            correlation_id: 0,
            expires_at: None,
            event,
        });

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
