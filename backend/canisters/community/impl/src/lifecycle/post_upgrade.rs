use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::model::events::CommunityEventInternal;
use crate::{Data, mutate_state, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, EventKey, Reader};
use community_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use types::{ChannelCreated, EventIndex, EventWrapperInternal};

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now);
    });

    // TODO: Delete after communities are upgraded
    mutate_state(|state| {
        // Read all the existing community events onto the heap
        let mut community_events = state.data.events.read_all_events();

        // Check that all events have an event index corresponding to their index in the vector
        for (index, event) in community_events.iter().enumerate() {
            if event.index != EventIndex::from(index as u32) {
                panic!("Event index mismatch: expected {}, got {}", index, event.index);
            }
        }

        // Append ChannelCreated events to CommunityEvents
        for channel in state.data.channels.iter() {
            if let Some(wrapper) = channel
                .chat
                .events
                .main_events_reader()
                .get_event(EventKey::EventIndex(EventIndex::from(0)))
            {
                if let ChatEventInternal::GroupChatCreated(event) = wrapper.event {
                    let new_event_wrapper = EventWrapperInternal {
                        index: EventIndex::from(0),
                        timestamp: channel.date_imported.unwrap_or(channel.chat.date_created),
                        expires_at: None,
                        event: CommunityEventInternal::ChannelCreated(Box::new(ChannelCreated {
                            channel_id: channel.id,
                            is_public: channel.chat.is_public.value,
                            name: event.name.clone(),
                            created_by: event.created_by,
                        })),
                    };

                    community_events.push(new_event_wrapper);
                } else {
                    panic!("Expected GroupChatCreated event, found {:?}", wrapper.event);
                }
            }
        }

        // Stable sort the community events by timestamp - events with the same timestamp will stay in the same order
        community_events.sort_by_key(|event| event.timestamp);

        // Iterate through the community events and rewrite the event indexes to match the vector index
        for (index, event) in community_events.iter_mut().enumerate() {
            event.index = EventIndex::from(index as u32);
        }

        // Write the updated community events back to stable memory
        state.data.events.overwrite_all_events(community_events);
    });
}
