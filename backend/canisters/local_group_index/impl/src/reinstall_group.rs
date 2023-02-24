use crate::{mutate_state, read_state, MARK_ACTIVE_DURATION};
use candid::Principal;
use chat_events::ChatEventInternal;
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::collections::{BTreeMap, HashMap, HashSet};
use tracing::{error, info};
use types::{
    Avatar, CanisterId, ChatId, EventIndex, EventWrapper, FrozenGroupInfo, HttpRequest, MessageContentInitial, MessageId,
    MessageIndex, TextContent, TimestampMillis, UserId, Version,
};

type CanisterToReinstall = utils::canister::CanisterToInstall<group_canister::init::Args>;

pub async fn reinstall_group(group_id: ChatId) -> Result<(), String> {
    let (this_canister_id, local_user_index) = mutate_state(|state| {
        if let Some(g) = state.data.group_being_reinstalled.as_ref().map(|g| g.group_id) {
            Err(format!("Reinstall already in progress. {g}"))
        } else {
            state.data.group_being_reinstalled = Some(GroupBeingReinstalled {
                group_id,
                started: state.env.now(),
                data: None,
            });
            Ok((state.env.canister_id(), state.data.local_user_index_canister_id))
        }
    })?;

    let result = reinstall_group_impl(group_id, this_canister_id, local_user_index).await;
    if let Err(ref error) = result {
        // Stop all reinstalls so that we can investigate what happened
        mutate_state(|state| state.data.max_concurrent_canister_upgrades = 0);

        error!(%group_id, "Failed to reinstall group. Error: {error}");
    } else {
        // Reset the `group_being_reinstalled` state
        mutate_state(|state| {
            let new_wasm_version = state.data.group_canister_wasm_for_upgrades.version;
            if let Some(group) = state.data.local_groups.get_mut(&group_id) {
                group.set_canister_upgrade_status(false, Some(new_wasm_version));
            }
            state.data.group_being_reinstalled = None;
        });

        info!(%group_id, "Successfully reinstalled group");
    }

    result
}

async fn reinstall_group_impl(
    group_id: ChatId,
    this_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
) -> Result<(), String> {
    // Join the group as a super admin
    local_user_index_canister_c2c_client::join_group(
        local_user_index_canister_id,
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            as_super_admin: true,
            invite_code: None,
            correlation_id: 0,
        },
    )
    .await
    .map_err(|e| format!("Failed to join group. {e:?}"))?;

    // Read all events
    let mut all_events = get_all_group_events(group_id, EventIndex::default()).await?;

    // Send message saying the group will be frozen while it is reinstalled
    group_canister_c2c_client::send_message_v2(
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: mutate_state(|state| MessageId::generate(state.env.rng())),
            content: MessageContentInitial::Text(TextContent {
                text: "Please wait while this group is reinstalled. It will be frozen temporarily and unfrozen once complete."
                    .to_string(),
            }),
            sender_name: "GroupUpgradeBot".to_string(),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            correlation_id: 0,
        },
    )
    .await
    .map_err(|e| format!("Failed to send message to group. {e:?}"))?;

    // Freeze_group
    let freeze_group_args = group_canister::c2c_freeze_group::Args {
        caller: this_canister_id.into(),
        reason: Some("Group being reinstalled".to_string()),
        return_members: false,
    };
    let group_frozen_info = match group_canister_c2c_client::c2c_freeze_group(group_id.into(), &freeze_group_args)
        .await
        .map_err(|e| format!("Failed to freeze group. {e:?}"))?
    {
        group_canister::c2c_freeze_group::Response::Success(f) => FrozenGroupInfo {
            timestamp: f.timestamp,
            frozen_by: this_canister_id.into(),
            reason: freeze_group_args.reason,
        },
        _ => unreachable!(),
    };

    // Check for any new events that may have been missed
    let new_events = get_all_group_events(
        group_id,
        all_events.events.last().map_or(EventIndex::default(), |e| e.index.incr()),
    )
    .await?;

    all_events.events.extend(new_events.events);
    all_events.thread_events.extend(new_events.thread_events);

    // Get the group summary
    let summary = match group_canister_c2c_client::c2c_summary(group_id.into(), &group_canister::c2c_summary::Args {})
        .await
        .map_err(|e| format!("Failed to get group summary. {e:?}"))?
    {
        group_canister::c2c_summary::Response::Success(r) => r.summary,
        _ => unreachable!(),
    };

    // Get the group details
    let details = match group_canister_c2c_client::selected_initial(group_id.into(), &group_canister::selected_initial::Args {})
        .await
        .map_err(|e| format!("Failed to get group details. {e:?}"))?
    {
        group_canister::selected_initial::Response::Success(r) => r,
        _ => unreachable!(),
    };

    let group_created_event = match &all_events.events.first().unwrap().event {
        ChatEventInternal::GroupChatCreated(g) => g,
        _ => unreachable!(),
    };

    // Get the group invite code
    let mut invite_code = None;
    if !summary.is_public {
        invite_code = match group_canister_c2c_client::invite_code(group_id.into(), &group_canister::invite_code::Args {})
            .await
            .map_err(|e| format!("Failed to get invite code. {e:?}"))?
        {
            group_canister::invite_code::Response::Success(r) => r.code,
            _ => unreachable!(),
        };
    }

    // Get the avatar
    let mut avatar = None;
    if let Some(avatar_id) = summary.avatar_id {
        let avatar_response = group_canister_c2c_client::http_request(
            group_id.into(),
            &HttpRequest {
                method: "GET".to_string(),
                url: format!("/avatar/{avatar_id}"),
                headers: Vec::new(),
                body: ByteBuf::new(),
            },
        )
        .await
        .map_err(|e| format!("Failed to get avatar. {e:?}"))?;

        avatar = Some(Avatar {
            id: avatar_id,
            mime_type: avatar_response.headers.into_iter().find(|h| h.0 == "Content-Type").unwrap().1,
            data: avatar_response.body.into_owned(),
        });
    }

    // Get all the users who have been members of the group
    let users: HashSet<_> = all_events
        .events
        .iter()
        .flat_map(|e| match &e.event {
            ChatEventInternal::GroupChatCreated(g) => vec![g.created_by],
            ChatEventInternal::ParticipantsAdded(p) => p.user_ids.clone(),
            ChatEventInternal::ParticipantJoined(p) => vec![p.user_id],
            _ => vec![],
        })
        .collect();

    // Get the principal for each user
    let local_user_index_canister::c2c_user_principals::Response::Success(user_principals) =
        local_user_index_canister_c2c_client::c2c_user_principals(
            local_user_index_canister_id,
            &local_user_index_canister::c2c_user_principals::Args {
                user_ids: users.into_iter().collect(),
            },
        )
        .await
        .map_err(|e| format!("Failed to get user principals. {e:?}"))?;

    // Build the init args
    let init_args = read_state(|state| group_canister::init::Args {
        is_public: summary.is_public,
        name: summary.name,
        description: summary.description,
        rules: details.rules,
        subtype: summary.subtype,
        avatar,
        history_visible_to_new_joiners: summary.history_visible_to_new_joiners,
        permissions: Some(summary.permissions),
        created_by_principal: *user_principals.get(&group_created_event.created_by).unwrap(),
        created_by_user_id: group_created_event.created_by,
        events_ttl: summary.events_ttl,
        mark_active_duration: MARK_ACTIVE_DURATION,
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        group_index_canister_id: state.data.group_index_canister_id,
        local_group_index_canister_id: this_canister_id,
        notifications_canister_id: state.data.notifications_canister_id,
        proposals_bot_user_id: state.data.proposals_bot_user_id,
        wasm_version: state.data.group_canister_wasm_for_upgrades.version,
        test_mode: state.data.test_mode,
        is_reinstall: true,
        date_created_override: Some(all_events.events.first().unwrap().timestamp),
        invite_code,
        invite_code_enabled: invite_code.is_some(),
        frozen: Some(group_frozen_info),
    });

    // Save everything to this canister's state
    let reinstall_args = mutate_state(|state| {
        let group = state
            .data
            .group_being_reinstalled
            .as_mut()
            .filter(|g| g.group_id == group_id && g.data.is_none())
            .ok_or_else(|| format!("Group data not found. {group_id}"))?;

        group.data = Some(GroupBeingReinstalledData {
            init_args: init_args.clone(),
            events: all_events,
            user_principals,
        });
        let args = CanisterToReinstall {
            canister_id: group_id.into(),
            current_wasm_version: Version::default(),
            new_wasm: state.data.group_canister_wasm_for_upgrades.clone(),
            deposit_cycles_if_needed: true,
            args: init_args,
            mode: CanisterInstallMode::Reinstall,
            stop_start_canister: false,
        };
        Ok::<CanisterToReinstall, String>(args)
    })?;

    // Reinstall the group
    utils::canister::install(reinstall_args)
        .await
        .map_err(|e| format!("Failed to reinstall group. {e:?}"))?;

    // Send all events to group
    send_all_events_to_group(group_id).await?;

    // Unfreeze the group
    group_canister_c2c_client::c2c_unfreeze_group(
        group_id.into(),
        &group_canister::c2c_unfreeze_group::Args {
            caller: this_canister_id.into(),
        },
    )
    .await
    .map_err(|e| format!("Failed to unfreeze group. {e:?}"))?;

    // Leave the group
    group_canister_c2c_client::c2c_leave_group(group_id.into(), &group_canister::c2c_leave_group::Args { correlation_id: 0 })
        .await
        .map_err(|e| format!("Failed to leave group. {e:?}"))?;

    Ok(())
}

async fn get_all_group_events(group_id: ChatId, since: EventIndex) -> Result<GroupBeingReinstalledEvents, String> {
    let events = get_group_events(group_id, None, since).await?;

    let threads: Vec<_> = events
        .iter()
        .filter_map(|e| {
            if let ChatEventInternal::Message(m) = &e.event {
                if m.thread_summary.is_some() {
                    return Some(m.message_index);
                }
            }
            None
        })
        .collect();

    let mut thread_events = BTreeMap::new();
    for batch in threads.chunks(20) {
        let futures = futures::future::try_join_all(batch.iter().copied().map(|m| async move {
            let events = get_group_events(group_id, Some(m), EventIndex::default()).await;
            events.map(|e| (m, e))
        }))
        .await?;

        for (message_index, events) in futures {
            thread_events.insert(message_index, events);
        }
    }

    Ok(GroupBeingReinstalledEvents {
        events,
        thread_events,
        events_synced_up_to: None,
        thread_events_synced_up_to: None,
    })
}

async fn get_group_events(
    group_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    since: EventIndex,
) -> Result<Vec<EventWrapper<ChatEventInternal>>, String> {
    let mut error_count = 0;
    let mut next_event_index = since;
    let mut events = Vec::new();
    loop {
        match group_canister_c2c_client::c2c_events_internal(
            group_id.into(),
            &group_canister::c2c_events_internal::Args {
                thread_root_message_index,
                start_index: next_event_index,
                max_events: 2000,
            },
        )
        .await
        {
            Ok(group_canister::c2c_events_internal::Response::Success(result)) => {
                if let Some(synced_up_to) = result.events.last().map(|e| e.index) {
                    next_event_index = synced_up_to.incr();
                }
                let complete = result.events.len() < 2000;
                events.extend(result.events);
                if complete {
                    return Ok(events);
                }
            }
            Ok(_) => unreachable!(),
            Err(error) => {
                error_count += 1;
                if error_count > 20 {
                    return Err(format!("Failed to get chat events. {error:?}"));
                }
            }
        }
    }
}

async fn send_all_events_to_group(group_id: ChatId) -> Result<(), String> {
    let batch_size = 2000usize;
    loop {
        let mut args = group_canister::c2c_initialize_events::Args {
            events: Vec::new(),
            thread_events: BTreeMap::new(),
            user_principals: HashMap::new(),
            is_complete: false,
        };
        let mut batch_size_remaining = batch_size;

        read_state(|state| {
            let group_data = state
                .data
                .group_being_reinstalled
                .as_ref()
                .filter(|g| g.group_id == group_id)
                .and_then(|g| g.data.as_ref())
                .ok_or_else(|| format!("Group data not found. {group_id}"))?;

            let next_event_index = group_data.events.events_synced_up_to.map_or(0usize, |e| e.incr().into());

            if next_event_index < group_data.events.events.len() {
                for event in group_data.events.events[next_event_index..].iter().take(batch_size) {
                    args.events.push(event.clone());
                }
                batch_size_remaining = batch_size_remaining.saturating_sub(args.events.len());
            }

            if batch_size_remaining > 0 {
                let next_thread_message_index = group_data
                    .events
                    .thread_events_synced_up_to
                    .map_or(MessageIndex::default(), |m| m.incr());

                for (message_index, events) in group_data.events.thread_events.range(next_thread_message_index..) {
                    args.thread_events.insert(*message_index, events.clone());
                    batch_size_remaining = batch_size_remaining.saturating_sub(events.len());
                    if batch_size_remaining == 0 {
                        break;
                    }
                }
            }

            if batch_size_remaining > group_data.user_principals.len()
                || (args.events.is_empty() && args.thread_events.is_empty())
            {
                args.user_principals = group_data.user_principals.clone();
                args.is_complete = true;
            }
            Ok::<(), String>(())
        })?;

        let events_synced_up_to = args.events.last().map(|e| e.index);
        let threads_synced_up_to = args.thread_events.last_key_value().map(|(k, _)| *k);
        let is_complete = args.is_complete;

        group_canister_c2c_client::c2c_initialize_events(group_id.into(), &args)
            .await
            .map_err(|e| format!("Failed to call 'c2c_initialize_events'. {e:?}"))?;

        mutate_state(|state| {
            let group_data = state
                .data
                .group_being_reinstalled
                .as_mut()
                .filter(|g| g.group_id == group_id)
                .and_then(|g| g.data.as_mut())
                .ok_or_else(|| format!("Group data not found. {group_id}"))?;

            if let Some(e) = events_synced_up_to {
                group_data.events.events_synced_up_to = Some(e);
            }
            if let Some(m) = threads_synced_up_to {
                group_data.events.thread_events_synced_up_to = Some(m);
            }
            Ok::<(), String>(())
        })?;

        if is_complete {
            break;
        }
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct GroupBeingReinstalled {
    group_id: ChatId,
    started: TimestampMillis,
    data: Option<GroupBeingReinstalledData>,
}

#[derive(Serialize, Deserialize)]
pub struct GroupBeingReinstalledData {
    init_args: group_canister::init::Args,
    events: GroupBeingReinstalledEvents,
    user_principals: HashMap<UserId, Principal>,
}

#[derive(Serialize, Deserialize)]
pub struct GroupBeingReinstalledEvents {
    events: Vec<EventWrapper<ChatEventInternal>>,
    thread_events: BTreeMap<MessageIndex, Vec<EventWrapper<ChatEventInternal>>>,
    events_synced_up_to: Option<EventIndex>,
    thread_events_synced_up_to: Option<MessageIndex>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GroupBeingReinstalledMetrics {
    group_id: ChatId,
    started: TimestampMillis,
    events_synced_up_to: Option<EventIndex>,
    thread_events_synced_up_to: Option<MessageIndex>,
}

impl From<&GroupBeingReinstalled> for GroupBeingReinstalledMetrics {
    fn from(value: &GroupBeingReinstalled) -> Self {
        GroupBeingReinstalledMetrics {
            group_id: value.group_id,
            started: value.started,
            events_synced_up_to: value.data.as_ref().and_then(|d| d.events.events_synced_up_to),
            thread_events_synced_up_to: value.data.as_ref().and_then(|d| d.events.thread_events_synced_up_to),
        }
    }
}
