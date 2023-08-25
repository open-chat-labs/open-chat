use crate::model::channels::Channels;
use crate::model::events::CommunityEvents;
use crate::model::groups_being_imported::GroupsBeingImported;
use crate::model::invited_users::InvitedUsers;
use crate::model::members::CommunityMembers;
use crate::timer_job_types::TimerJob;
use crate::Data;
use activity_notification_state::ActivityNotificationState;
use canister_timer_jobs::TimerJobs;
use fire_and_forget_handler::FireAndForgetHandler;
use group_chat_core::AccessRulesInternal;
use types::{
    AccessGate, CanisterId, ChatMetrics, CommunityPermissions, Document, FrozenGroupInfo, TimestampMillis, Timestamped, UserId,
};

// The code below is the expansion of `#[derive(Deserialize)]` for `Data`, but it has been modified
// so that when the `groups_being_imported` field is reached, it exits without deserializing it or
// the remaining fields. The fields are serialized in order, so the fields after
// `group_being_imported` are `test_mode` and `cached_chat_metrics`, both of which can safely be set
// to default.

#[allow(unused_extern_crates, clippy::useless_attribute)]
extern crate serde as _serde;
#[automatically_derived]
impl<'de> _serde::Deserialize<'de> for Data {
    fn deserialize<__D>(__deserializer: __D) -> _serde::__private::Result<Self, __D::Error>
    where
        __D: _serde::Deserializer<'de>,
    {
        #[allow(non_camel_case_types)]
        #[doc(hidden)]
        enum __Field {
            __field0,
            __field1,
            __field2,
            __field3,
            __field4,
            __field5,
            __field6,
            __field7,
            __field8,
            __field9,
            __field10,
            __field11,
            __field12,
            __field13,
            __field14,
            __field15,
            __field16,
            __field17,
            __field18,
            __field19,
            __field20,
            __field21,
            __field22,
            __field23,
            __field24,
            __field25,
            __field26,
            __field27,
            __field28,
            __ignore,
        }
        #[doc(hidden)]
        struct __FieldVisitor;
        impl<'de> _serde::de::Visitor<'de> for __FieldVisitor {
            type Value = __Field;
            fn expecting(&self, __formatter: &mut _serde::__private::Formatter) -> _serde::__private::fmt::Result {
                _serde::__private::Formatter::write_str(__formatter, "field identifier")
            }
            fn visit_u64<__E>(self, __value: u64) -> _serde::__private::Result<Self::Value, __E>
            where
                __E: _serde::de::Error,
            {
                match __value {
                    0u64 => _serde::__private::Ok(__Field::__field0),
                    1u64 => _serde::__private::Ok(__Field::__field1),
                    2u64 => _serde::__private::Ok(__Field::__field2),
                    3u64 => _serde::__private::Ok(__Field::__field3),
                    4u64 => _serde::__private::Ok(__Field::__field4),
                    5u64 => _serde::__private::Ok(__Field::__field5),
                    6u64 => _serde::__private::Ok(__Field::__field6),
                    7u64 => _serde::__private::Ok(__Field::__field7),
                    8u64 => _serde::__private::Ok(__Field::__field8),
                    9u64 => _serde::__private::Ok(__Field::__field9),
                    10u64 => _serde::__private::Ok(__Field::__field10),
                    11u64 => _serde::__private::Ok(__Field::__field11),
                    12u64 => _serde::__private::Ok(__Field::__field12),
                    13u64 => _serde::__private::Ok(__Field::__field13),
                    14u64 => _serde::__private::Ok(__Field::__field14),
                    15u64 => _serde::__private::Ok(__Field::__field15),
                    16u64 => _serde::__private::Ok(__Field::__field16),
                    17u64 => _serde::__private::Ok(__Field::__field17),
                    18u64 => _serde::__private::Ok(__Field::__field18),
                    19u64 => _serde::__private::Ok(__Field::__field19),
                    20u64 => _serde::__private::Ok(__Field::__field20),
                    21u64 => _serde::__private::Ok(__Field::__field21),
                    22u64 => _serde::__private::Ok(__Field::__field22),
                    23u64 => _serde::__private::Ok(__Field::__field23),
                    24u64 => _serde::__private::Ok(__Field::__field24),
                    25u64 => _serde::__private::Ok(__Field::__field25),
                    26u64 => _serde::__private::Ok(__Field::__field26),
                    27u64 => _serde::__private::Ok(__Field::__field27),
                    28u64 => _serde::__private::Ok(__Field::__field28),
                    _ => _serde::__private::Ok(__Field::__ignore),
                }
            }
            fn visit_str<__E>(self, __value: &str) -> _serde::__private::Result<Self::Value, __E>
            where
                __E: _serde::de::Error,
            {
                match __value {
                    "is_public" => _serde::__private::Ok(__Field::__field0),
                    "name" => _serde::__private::Ok(__Field::__field1),
                    "description" => _serde::__private::Ok(__Field::__field2),
                    "rules" => _serde::__private::Ok(__Field::__field3),
                    "avatar" => _serde::__private::Ok(__Field::__field4),
                    "banner" => _serde::__private::Ok(__Field::__field5),
                    "permissions" => _serde::__private::Ok(__Field::__field6),
                    "gate" => _serde::__private::Ok(__Field::__field7),
                    "primary_language" => _serde::__private::Ok(__Field::__field8),
                    "user_index_canister_id" => _serde::__private::Ok(__Field::__field9),
                    "local_user_index_canister_id" => _serde::__private::Ok(__Field::__field10),
                    "group_index_canister_id" => _serde::__private::Ok(__Field::__field11),
                    "local_group_index_canister_id" => _serde::__private::Ok(__Field::__field12),
                    "notifications_canister_id" => _serde::__private::Ok(__Field::__field13),
                    "proposals_bot_user_id" => _serde::__private::Ok(__Field::__field14),
                    "date_created" => _serde::__private::Ok(__Field::__field15),
                    "members" => _serde::__private::Ok(__Field::__field16),
                    "channels" => _serde::__private::Ok(__Field::__field17),
                    "events" => _serde::__private::Ok(__Field::__field18),
                    "invited_users" => _serde::__private::Ok(__Field::__field19),
                    "invite_code" => _serde::__private::Ok(__Field::__field20),
                    "invite_code_enabled" => _serde::__private::Ok(__Field::__field21),
                    "frozen" => _serde::__private::Ok(__Field::__field22),
                    "timer_jobs" => _serde::__private::Ok(__Field::__field23),
                    "fire_and_forget_handler" => _serde::__private::Ok(__Field::__field24),
                    "activity_notification_state" => _serde::__private::Ok(__Field::__field25),
                    "groups_being_imported" => _serde::__private::Ok(__Field::__field26),
                    "test_mode" => _serde::__private::Ok(__Field::__field27),
                    "cached_chat_metrics" => _serde::__private::Ok(__Field::__field28),
                    _ => _serde::__private::Ok(__Field::__ignore),
                }
            }
            fn visit_bytes<__E>(self, __value: &[u8]) -> _serde::__private::Result<Self::Value, __E>
            where
                __E: _serde::de::Error,
            {
                match __value {
                    b"is_public" => _serde::__private::Ok(__Field::__field0),
                    b"name" => _serde::__private::Ok(__Field::__field1),
                    b"description" => _serde::__private::Ok(__Field::__field2),
                    b"rules" => _serde::__private::Ok(__Field::__field3),
                    b"avatar" => _serde::__private::Ok(__Field::__field4),
                    b"banner" => _serde::__private::Ok(__Field::__field5),
                    b"permissions" => _serde::__private::Ok(__Field::__field6),
                    b"gate" => _serde::__private::Ok(__Field::__field7),
                    b"primary_language" => _serde::__private::Ok(__Field::__field8),
                    b"user_index_canister_id" => _serde::__private::Ok(__Field::__field9),
                    b"local_user_index_canister_id" => _serde::__private::Ok(__Field::__field10),
                    b"group_index_canister_id" => _serde::__private::Ok(__Field::__field11),
                    b"local_group_index_canister_id" => _serde::__private::Ok(__Field::__field12),
                    b"notifications_canister_id" => _serde::__private::Ok(__Field::__field13),
                    b"proposals_bot_user_id" => _serde::__private::Ok(__Field::__field14),
                    b"date_created" => _serde::__private::Ok(__Field::__field15),
                    b"members" => _serde::__private::Ok(__Field::__field16),
                    b"channels" => _serde::__private::Ok(__Field::__field17),
                    b"events" => _serde::__private::Ok(__Field::__field18),
                    b"invited_users" => _serde::__private::Ok(__Field::__field19),
                    b"invite_code" => _serde::__private::Ok(__Field::__field20),
                    b"invite_code_enabled" => _serde::__private::Ok(__Field::__field21),
                    b"frozen" => _serde::__private::Ok(__Field::__field22),
                    b"timer_jobs" => _serde::__private::Ok(__Field::__field23),
                    b"fire_and_forget_handler" => _serde::__private::Ok(__Field::__field24),
                    b"activity_notification_state" => _serde::__private::Ok(__Field::__field25),
                    b"groups_being_imported" => _serde::__private::Ok(__Field::__field26),
                    b"test_mode" => _serde::__private::Ok(__Field::__field27),
                    b"cached_chat_metrics" => _serde::__private::Ok(__Field::__field28),
                    _ => _serde::__private::Ok(__Field::__ignore),
                }
            }
        }
        impl<'de> _serde::Deserialize<'de> for __Field {
            #[inline]
            fn deserialize<__D>(__deserializer: __D) -> _serde::__private::Result<Self, __D::Error>
            where
                __D: _serde::Deserializer<'de>,
            {
                _serde::Deserializer::deserialize_identifier(__deserializer, __FieldVisitor)
            }
        }
        #[doc(hidden)]
        struct __Visitor<'de> {
            marker: _serde::__private::PhantomData<Data>,
            lifetime: _serde::__private::PhantomData<&'de ()>,
        }
        impl<'de> _serde::de::Visitor<'de> for __Visitor<'de> {
            type Value = Data;
            fn expecting(&self, __formatter: &mut _serde::__private::Formatter) -> _serde::__private::fmt::Result {
                _serde::__private::Formatter::write_str(__formatter, "struct Data")
            }
            #[inline]
            fn visit_seq<__A>(self, mut __seq: __A) -> _serde::__private::Result<Self::Value, __A::Error>
            where
                __A: _serde::de::SeqAccess<'de>,
            {
                let __field0 = match _serde::de::SeqAccess::next_element::<bool>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            0usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field1 = match _serde::de::SeqAccess::next_element::<String>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            1usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field2 = match _serde::de::SeqAccess::next_element::<String>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            2usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field3 = match _serde::de::SeqAccess::next_element::<AccessRulesInternal>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            3usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field4 = match _serde::de::SeqAccess::next_element::<Option<Document>>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            4usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field5 = match _serde::de::SeqAccess::next_element::<Option<Document>>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            5usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field6 = match _serde::de::SeqAccess::next_element::<CommunityPermissions>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            6usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field7 = match _serde::de::SeqAccess::next_element::<Timestamped<Option<AccessGate>>>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            7usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field8 = match _serde::de::SeqAccess::next_element::<String>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            8usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field9 = match _serde::de::SeqAccess::next_element::<CanisterId>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            9usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field10 = match _serde::de::SeqAccess::next_element::<CanisterId>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            10usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field11 = match _serde::de::SeqAccess::next_element::<CanisterId>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            11usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field12 = match _serde::de::SeqAccess::next_element::<CanisterId>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            12usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field13 = match _serde::de::SeqAccess::next_element::<CanisterId>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            13usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field14 = match _serde::de::SeqAccess::next_element::<UserId>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            14usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field15 = match _serde::de::SeqAccess::next_element::<TimestampMillis>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            15usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field16 = match _serde::de::SeqAccess::next_element::<CommunityMembers>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            16usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field17 = match _serde::de::SeqAccess::next_element::<Channels>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            17usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field18 = match _serde::de::SeqAccess::next_element::<CommunityEvents>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            18usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field19 = match _serde::de::SeqAccess::next_element::<InvitedUsers>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            19usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field20 = match _serde::de::SeqAccess::next_element::<Option<u64>>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            20usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field21 = match _serde::de::SeqAccess::next_element::<bool>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            21usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field22 = match _serde::de::SeqAccess::next_element::<Timestamped<Option<FrozenGroupInfo>>>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            22usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field23 = match _serde::de::SeqAccess::next_element::<TimerJobs<TimerJob>>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            23usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field24 = match _serde::de::SeqAccess::next_element::<FireAndForgetHandler>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            24usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field25 = match _serde::de::SeqAccess::next_element::<ActivityNotificationState>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => {
                        return _serde::__private::Err(_serde::de::Error::invalid_length(
                            25usize,
                            &"struct Data with 29 elements",
                        ))
                    }
                };
                let __field26 = match _serde::de::SeqAccess::next_element::<GroupsBeingImported>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => _serde::__private::Default::default(),
                };
                let __field27 = match _serde::de::SeqAccess::next_element::<bool>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => _serde::__private::Default::default(),
                };
                let __field28 = match _serde::de::SeqAccess::next_element::<Timestamped<ChatMetrics>>(&mut __seq)? {
                    _serde::__private::Some(__value) => __value,
                    _serde::__private::None => _serde::__private::Default::default(),
                };
                _serde::__private::Ok(Data {
                    is_public: __field0,
                    name: __field1,
                    description: __field2,
                    rules: __field3,
                    avatar: __field4,
                    banner: __field5,
                    permissions: __field6,
                    gate: __field7,
                    primary_language: __field8,
                    user_index_canister_id: __field9,
                    local_user_index_canister_id: __field10,
                    group_index_canister_id: __field11,
                    local_group_index_canister_id: __field12,
                    notifications_canister_id: __field13,
                    proposals_bot_user_id: __field14,
                    date_created: __field15,
                    members: __field16,
                    channels: __field17,
                    events: __field18,
                    invited_users: __field19,
                    invite_code: __field20,
                    invite_code_enabled: __field21,
                    frozen: __field22,
                    timer_jobs: __field23,
                    fire_and_forget_handler: __field24,
                    activity_notification_state: __field25,
                    groups_being_imported: __field26,
                    test_mode: __field27,
                    cached_chat_metrics: __field28,
                })
            }
            #[inline]
            fn visit_map<__A>(self, mut __map: __A) -> _serde::__private::Result<Self::Value, __A::Error>
            where
                __A: _serde::de::MapAccess<'de>,
            {
                let mut __field0: _serde::__private::Option<bool> = _serde::__private::None;
                let mut __field1: _serde::__private::Option<String> = _serde::__private::None;
                let mut __field2: _serde::__private::Option<String> = _serde::__private::None;
                let mut __field3: _serde::__private::Option<AccessRulesInternal> = _serde::__private::None;
                let mut __field4: _serde::__private::Option<Option<Document>> = _serde::__private::None;
                let mut __field5: _serde::__private::Option<Option<Document>> = _serde::__private::None;
                let mut __field6: _serde::__private::Option<CommunityPermissions> = _serde::__private::None;
                let mut __field7: _serde::__private::Option<Timestamped<Option<AccessGate>>> = _serde::__private::None;
                let mut __field8: _serde::__private::Option<String> = _serde::__private::None;
                let mut __field9: _serde::__private::Option<CanisterId> = _serde::__private::None;
                let mut __field10: _serde::__private::Option<CanisterId> = _serde::__private::None;
                let mut __field11: _serde::__private::Option<CanisterId> = _serde::__private::None;
                let mut __field12: _serde::__private::Option<CanisterId> = _serde::__private::None;
                let mut __field13: _serde::__private::Option<CanisterId> = _serde::__private::None;
                let mut __field14: _serde::__private::Option<UserId> = _serde::__private::None;
                let mut __field15: _serde::__private::Option<TimestampMillis> = _serde::__private::None;
                let mut __field16: _serde::__private::Option<CommunityMembers> = _serde::__private::None;
                let mut __field17: _serde::__private::Option<Channels> = _serde::__private::None;
                let mut __field18: _serde::__private::Option<CommunityEvents> = _serde::__private::None;
                let mut __field19: _serde::__private::Option<InvitedUsers> = _serde::__private::None;
                let mut __field20: _serde::__private::Option<Option<u64>> = _serde::__private::None;
                let mut __field21: _serde::__private::Option<bool> = _serde::__private::None;
                let mut __field22: _serde::__private::Option<Timestamped<Option<FrozenGroupInfo>>> = _serde::__private::None;
                let mut __field23: _serde::__private::Option<TimerJobs<TimerJob>> = _serde::__private::None;
                let mut __field24: _serde::__private::Option<FireAndForgetHandler> = _serde::__private::None;
                let mut __field25: _serde::__private::Option<ActivityNotificationState> = _serde::__private::None;
                let mut __field26: _serde::__private::Option<GroupsBeingImported> = _serde::__private::None;
                let mut __field27: _serde::__private::Option<bool> = _serde::__private::None;
                let mut __field28: _serde::__private::Option<Timestamped<ChatMetrics>> = _serde::__private::None;
                while let _serde::__private::Some(__key) = _serde::de::MapAccess::next_key::<__Field>(&mut __map)? {
                    match __key {
                        __Field::__field0 => {
                            if _serde::__private::Option::is_some(&__field0) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("is_public"));
                            }
                            __field0 = _serde::__private::Some(_serde::de::MapAccess::next_value::<bool>(&mut __map)?);
                        }
                        __Field::__field1 => {
                            if _serde::__private::Option::is_some(&__field1) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("name"));
                            }
                            __field1 = _serde::__private::Some(_serde::de::MapAccess::next_value::<String>(&mut __map)?);
                        }
                        __Field::__field2 => {
                            if _serde::__private::Option::is_some(&__field2) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "description",
                                ));
                            }
                            __field2 = _serde::__private::Some(_serde::de::MapAccess::next_value::<String>(&mut __map)?);
                        }
                        __Field::__field3 => {
                            if _serde::__private::Option::is_some(&__field3) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("rules"));
                            }
                            __field3 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<AccessRulesInternal>(&mut __map)?);
                        }
                        __Field::__field4 => {
                            if _serde::__private::Option::is_some(&__field4) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("avatar"));
                            }
                            __field4 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<Option<Document>>(&mut __map)?);
                        }
                        __Field::__field5 => {
                            if _serde::__private::Option::is_some(&__field5) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("banner"));
                            }
                            __field5 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<Option<Document>>(&mut __map)?);
                        }
                        __Field::__field6 => {
                            if _serde::__private::Option::is_some(&__field6) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "permissions",
                                ));
                            }
                            __field6 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<CommunityPermissions>(&mut __map)?);
                        }
                        __Field::__field7 => {
                            if _serde::__private::Option::is_some(&__field7) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("gate"));
                            }
                            __field7 = _serde::__private::Some(_serde::de::MapAccess::next_value::<
                                Timestamped<Option<AccessGate>>,
                            >(&mut __map)?);
                        }
                        __Field::__field8 => {
                            if _serde::__private::Option::is_some(&__field8) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "primary_language",
                                ));
                            }
                            __field8 = _serde::__private::Some(_serde::de::MapAccess::next_value::<String>(&mut __map)?);
                        }
                        __Field::__field9 => {
                            if _serde::__private::Option::is_some(&__field9) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "user_index_canister_id",
                                ));
                            }
                            __field9 = _serde::__private::Some(_serde::de::MapAccess::next_value::<CanisterId>(&mut __map)?);
                        }
                        __Field::__field10 => {
                            if _serde::__private::Option::is_some(&__field10) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "local_user_index_canister_id",
                                ));
                            }
                            __field10 = _serde::__private::Some(_serde::de::MapAccess::next_value::<CanisterId>(&mut __map)?);
                        }
                        __Field::__field11 => {
                            if _serde::__private::Option::is_some(&__field11) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "group_index_canister_id",
                                ));
                            }
                            __field11 = _serde::__private::Some(_serde::de::MapAccess::next_value::<CanisterId>(&mut __map)?);
                        }
                        __Field::__field12 => {
                            if _serde::__private::Option::is_some(&__field12) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "local_group_index_canister_id",
                                ));
                            }
                            __field12 = _serde::__private::Some(_serde::de::MapAccess::next_value::<CanisterId>(&mut __map)?);
                        }
                        __Field::__field13 => {
                            if _serde::__private::Option::is_some(&__field13) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "notifications_canister_id",
                                ));
                            }
                            __field13 = _serde::__private::Some(_serde::de::MapAccess::next_value::<CanisterId>(&mut __map)?);
                        }
                        __Field::__field14 => {
                            if _serde::__private::Option::is_some(&__field14) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "proposals_bot_user_id",
                                ));
                            }
                            __field14 = _serde::__private::Some(_serde::de::MapAccess::next_value::<UserId>(&mut __map)?);
                        }
                        __Field::__field15 => {
                            if _serde::__private::Option::is_some(&__field15) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "date_created",
                                ));
                            }
                            __field15 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<TimestampMillis>(&mut __map)?);
                        }
                        __Field::__field16 => {
                            if _serde::__private::Option::is_some(&__field16) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("members"));
                            }
                            __field16 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<CommunityMembers>(&mut __map)?);
                        }
                        __Field::__field17 => {
                            if _serde::__private::Option::is_some(&__field17) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("channels"));
                            }
                            __field17 = _serde::__private::Some(_serde::de::MapAccess::next_value::<Channels>(&mut __map)?);
                        }
                        __Field::__field18 => {
                            if _serde::__private::Option::is_some(&__field18) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("events"));
                            }
                            __field18 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<CommunityEvents>(&mut __map)?);
                        }
                        __Field::__field19 => {
                            if _serde::__private::Option::is_some(&__field19) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "invited_users",
                                ));
                            }
                            __field19 = _serde::__private::Some(_serde::de::MapAccess::next_value::<InvitedUsers>(&mut __map)?);
                        }
                        __Field::__field20 => {
                            if _serde::__private::Option::is_some(&__field20) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "invite_code",
                                ));
                            }
                            __field20 = _serde::__private::Some(_serde::de::MapAccess::next_value::<Option<u64>>(&mut __map)?);
                        }
                        __Field::__field21 => {
                            if _serde::__private::Option::is_some(&__field21) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "invite_code_enabled",
                                ));
                            }
                            __field21 = _serde::__private::Some(_serde::de::MapAccess::next_value::<bool>(&mut __map)?);
                        }
                        __Field::__field22 => {
                            if _serde::__private::Option::is_some(&__field22) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("frozen"));
                            }
                            __field22 = _serde::__private::Some(_serde::de::MapAccess::next_value::<
                                Timestamped<Option<FrozenGroupInfo>>,
                            >(&mut __map)?);
                        }
                        __Field::__field23 => {
                            if _serde::__private::Option::is_some(&__field23) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "timer_jobs",
                                ));
                            }
                            __field23 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<TimerJobs<TimerJob>>(&mut __map)?);
                        }
                        __Field::__field24 => {
                            if _serde::__private::Option::is_some(&__field24) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "fire_and_forget_handler",
                                ));
                            }
                            __field24 =
                                _serde::__private::Some(_serde::de::MapAccess::next_value::<FireAndForgetHandler>(&mut __map)?);
                        }
                        __Field::__field25 => {
                            if _serde::__private::Option::is_some(&__field25) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "activity_notification_state",
                                ));
                            }
                            __field25 = _serde::__private::Some(
                                _serde::de::MapAccess::next_value::<ActivityNotificationState>(&mut __map)?,
                            );
                        }
                        __Field::__field26 => {
                            // This is the hack...
                            // We consume all the remaining fields and exit.
                            // This is because attempting to deserialize `groups_being_imported`
                            // exceeds the instruction limit.
                            while _serde::de::MapAccess::next_key::<__Field>(&mut __map).is_err() {}
                            break;
                            // if _serde::__private::Option::is_some(&__field26) {
                            //     return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                            //         "groups_being_imported",
                            //     ));
                            // }
                            // __field26 =
                            //     _serde::__private::Some(_serde::de::MapAccess::next_value::<GroupsBeingImported>(&mut __map)?);
                        }
                        __Field::__field27 => {
                            if _serde::__private::Option::is_some(&__field27) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field("test_mode"));
                            }
                            __field27 = _serde::__private::Some(_serde::de::MapAccess::next_value::<bool>(&mut __map)?);
                        }
                        __Field::__field28 => {
                            if _serde::__private::Option::is_some(&__field28) {
                                return _serde::__private::Err(<__A::Error as _serde::de::Error>::duplicate_field(
                                    "cached_chat_metrics",
                                ));
                            }
                            __field28 = _serde::__private::Some(_serde::de::MapAccess::next_value::<Timestamped<ChatMetrics>>(
                                &mut __map,
                            )?);
                        }
                        _ => {
                            let _ = _serde::de::MapAccess::next_value::<_serde::de::IgnoredAny>(&mut __map)?;
                        }
                    }
                }
                let __field0 = match __field0 {
                    _serde::__private::Some(__field0) => __field0,
                    _serde::__private::None => _serde::__private::de::missing_field("is_public")?,
                };
                let __field1 = match __field1 {
                    _serde::__private::Some(__field1) => __field1,
                    _serde::__private::None => _serde::__private::de::missing_field("name")?,
                };
                let __field2 = match __field2 {
                    _serde::__private::Some(__field2) => __field2,
                    _serde::__private::None => _serde::__private::de::missing_field("description")?,
                };
                let __field3 = match __field3 {
                    _serde::__private::Some(__field3) => __field3,
                    _serde::__private::None => _serde::__private::de::missing_field("rules")?,
                };
                let __field4 = match __field4 {
                    _serde::__private::Some(__field4) => __field4,
                    _serde::__private::None => _serde::__private::de::missing_field("avatar")?,
                };
                let __field5 = match __field5 {
                    _serde::__private::Some(__field5) => __field5,
                    _serde::__private::None => _serde::__private::de::missing_field("banner")?,
                };
                let __field6 = match __field6 {
                    _serde::__private::Some(__field6) => __field6,
                    _serde::__private::None => _serde::__private::de::missing_field("permissions")?,
                };
                let __field7 = match __field7 {
                    _serde::__private::Some(__field7) => __field7,
                    _serde::__private::None => _serde::__private::de::missing_field("gate")?,
                };
                let __field8 = match __field8 {
                    _serde::__private::Some(__field8) => __field8,
                    _serde::__private::None => _serde::__private::de::missing_field("primary_language")?,
                };
                let __field9 = match __field9 {
                    _serde::__private::Some(__field9) => __field9,
                    _serde::__private::None => _serde::__private::de::missing_field("user_index_canister_id")?,
                };
                let __field10 = match __field10 {
                    _serde::__private::Some(__field10) => __field10,
                    _serde::__private::None => _serde::__private::de::missing_field("local_user_index_canister_id")?,
                };
                let __field11 = match __field11 {
                    _serde::__private::Some(__field11) => __field11,
                    _serde::__private::None => _serde::__private::de::missing_field("group_index_canister_id")?,
                };
                let __field12 = match __field12 {
                    _serde::__private::Some(__field12) => __field12,
                    _serde::__private::None => _serde::__private::de::missing_field("local_group_index_canister_id")?,
                };
                let __field13 = match __field13 {
                    _serde::__private::Some(__field13) => __field13,
                    _serde::__private::None => _serde::__private::de::missing_field("notifications_canister_id")?,
                };
                let __field14 = match __field14 {
                    _serde::__private::Some(__field14) => __field14,
                    _serde::__private::None => _serde::__private::de::missing_field("proposals_bot_user_id")?,
                };
                let __field15 = match __field15 {
                    _serde::__private::Some(__field15) => __field15,
                    _serde::__private::None => _serde::__private::de::missing_field("date_created")?,
                };
                let __field16 = match __field16 {
                    _serde::__private::Some(__field16) => __field16,
                    _serde::__private::None => _serde::__private::de::missing_field("members")?,
                };
                let __field17 = match __field17 {
                    _serde::__private::Some(__field17) => __field17,
                    _serde::__private::None => _serde::__private::de::missing_field("channels")?,
                };
                let __field18 = match __field18 {
                    _serde::__private::Some(__field18) => __field18,
                    _serde::__private::None => _serde::__private::de::missing_field("events")?,
                };
                let __field19 = match __field19 {
                    _serde::__private::Some(__field19) => __field19,
                    _serde::__private::None => _serde::__private::de::missing_field("invited_users")?,
                };
                let __field20 = match __field20 {
                    _serde::__private::Some(__field20) => __field20,
                    _serde::__private::None => _serde::__private::de::missing_field("invite_code")?,
                };
                let __field21 = match __field21 {
                    _serde::__private::Some(__field21) => __field21,
                    _serde::__private::None => _serde::__private::de::missing_field("invite_code_enabled")?,
                };
                let __field22 = match __field22 {
                    _serde::__private::Some(__field22) => __field22,
                    _serde::__private::None => _serde::__private::de::missing_field("frozen")?,
                };
                let __field23 = match __field23 {
                    _serde::__private::Some(__field23) => __field23,
                    _serde::__private::None => _serde::__private::de::missing_field("timer_jobs")?,
                };
                let __field24 = match __field24 {
                    _serde::__private::Some(__field24) => __field24,
                    _serde::__private::None => _serde::__private::de::missing_field("fire_and_forget_handler")?,
                };
                let __field25 = match __field25 {
                    _serde::__private::Some(__field25) => __field25,
                    _serde::__private::None => _serde::__private::de::missing_field("activity_notification_state")?,
                };
                let __field26 = match __field26 {
                    _serde::__private::Some(__field26) => __field26,
                    _serde::__private::None => _serde::__private::Default::default(),
                };
                let __field27 = match __field27 {
                    _serde::__private::Some(__field27) => __field27,
                    _serde::__private::None => _serde::__private::Default::default(),
                };
                let __field28 = match __field28 {
                    _serde::__private::Some(__field28) => __field28,
                    _serde::__private::None => _serde::__private::Default::default(),
                };
                _serde::__private::Ok(Data {
                    is_public: __field0,
                    name: __field1,
                    description: __field2,
                    rules: __field3,
                    avatar: __field4,
                    banner: __field5,
                    permissions: __field6,
                    gate: __field7,
                    primary_language: __field8,
                    user_index_canister_id: __field9,
                    local_user_index_canister_id: __field10,
                    group_index_canister_id: __field11,
                    local_group_index_canister_id: __field12,
                    notifications_canister_id: __field13,
                    proposals_bot_user_id: __field14,
                    date_created: __field15,
                    members: __field16,
                    channels: __field17,
                    events: __field18,
                    invited_users: __field19,
                    invite_code: __field20,
                    invite_code_enabled: __field21,
                    frozen: __field22,
                    timer_jobs: __field23,
                    fire_and_forget_handler: __field24,
                    activity_notification_state: __field25,
                    groups_being_imported: __field26,
                    test_mode: __field27,
                    cached_chat_metrics: __field28,
                })
            }
        }
        #[doc(hidden)]
        const FIELDS: &[&str] = &[
            "is_public",
            "name",
            "description",
            "rules",
            "avatar",
            "banner",
            "permissions",
            "gate",
            "primary_language",
            "user_index_canister_id",
            "local_user_index_canister_id",
            "group_index_canister_id",
            "local_group_index_canister_id",
            "notifications_canister_id",
            "proposals_bot_user_id",
            "date_created",
            "members",
            "channels",
            "events",
            "invited_users",
            "invite_code",
            "invite_code_enabled",
            "frozen",
            "timer_jobs",
            "fire_and_forget_handler",
            "activity_notification_state",
            "groups_being_imported",
            "test_mode",
            "cached_chat_metrics",
        ];
        _serde::Deserializer::deserialize_struct(
            __deserializer,
            "Data",
            FIELDS,
            __Visitor {
                marker: _serde::__private::PhantomData::<Data>,
                lifetime: _serde::__private::PhantomData,
            },
        )
    }
}
