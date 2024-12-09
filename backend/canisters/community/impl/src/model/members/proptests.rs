use crate::model::members::CommunityMembers;
use candid::Principal;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use ic_stable_structures::DefaultMemoryImpl;
use proptest::collection::vec as pvec;
use proptest::prelude::*;
use proptest::prop_oneof;
use std::collections::{BTreeMap, BTreeSet};
use test_strategy::proptest;
use types::{CommunityPermissions, CommunityRole, TimestampMillis, UserId, UserType};

#[derive(Debug, Clone)]
enum Operation {
    Add {
        user_id: UserId,
        referred_by_index: Option<usize>,
    },
    ChangeRole {
        owner_index: usize,
        user_index: usize,
        role: CommunityRole,
    },
    Remove {
        user_index: usize,
    },
    SetDisplayName {
        user_index: usize,
        value: Option<String>,
    },
    Block {
        user_index: usize,
    },
    Unblock {
        user_index: usize,
    },
    Lapse {
        user_index: usize,
    },
    Unlapse {
        user_index: usize,
    },
    UnlapseAll,
    SetSuspended {
        user_index: usize,
        suspended: bool,
    },
}

fn operation_strategy() -> impl Strategy<Value = Operation> {
    prop_oneof![
        50 => (any::<usize>(), any::<bool>(), any::<usize>())
            .prop_map(|(user_index, set_referrer, referrer_index)| Operation::Add { user_id: user_id(user_index), referred_by_index: set_referrer.then_some(referrer_index) }),
        20 => (any::<usize>(), any::<usize>(), any::<usize>())
            .prop_map(|(owner_index, user_index, role_index)| Operation::ChangeRole { owner_index, user_index, role: role(role_index) }),
        10 => (any::<usize>(), any::<usize>()).prop_map(|(user_index, value)| Operation::SetDisplayName { user_index, value: Some(value.to_string()) } ),
        5 => (any::<usize>()).prop_map(|user_index| Operation::SetDisplayName { user_index, value: None }),
        10 => any::<usize>().prop_map(|user_index| Operation::Remove { user_index}),
        5 => any::<usize>().prop_map(|user_index| Operation::Block { user_index}),
        3 => any::<usize>().prop_map(|user_index| Operation::Unblock { user_index}),
        5 => any::<usize>().prop_map(|user_index| Operation::Lapse { user_index}),
        3 => any::<usize>().prop_map(|user_index| Operation::Unlapse { user_index}),
        1 => Just(Operation::UnlapseAll),
        2 => any::<usize>().prop_map(|user_index| Operation::SetSuspended { user_index, suspended: true }),
        1 => any::<usize>().prop_map(|user_index| Operation::SetSuspended { user_index, suspended: false }),
    ]
}

#[proptest(cases = 10)]
fn comprehensive(#[strategy(pvec(operation_strategy(), 1_000..5_000))] ops: Vec<Operation>) {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init(memory.get(MemoryId::new(1)));

    let mut members = CommunityMembers::new(principal(0), user_id(0), UserType::User, vec![1u32.into()], 0);

    let mut timestamp = 1000;
    for op in ops.into_iter() {
        execute_operation(&mut members, op, timestamp);
        timestamp += 1000;
    }

    members.check_invariants();
}

fn execute_operation(members: &mut CommunityMembers, op: Operation, timestamp: TimestampMillis) {
    match op {
        Operation::Add {
            user_id,
            referred_by_index,
        } => {
            let referred_by = referred_by_index.and_then(|i| {
                if members.members_and_channels.is_empty() {
                    None
                } else {
                    Some(get_from_map(&members.members_and_channels, i))
                }
            });
            members.add(user_id, user_id.into(), UserType::User, referred_by, timestamp);
        }
        Operation::ChangeRole {
            owner_index,
            user_index,
            role,
        } => {
            let owner = get_from_set(&members.owners, owner_index);
            let user_id = get_from_map(&members.members_and_channels, user_index);
            members.change_role(
                owner,
                user_id,
                role,
                &CommunityPermissions::default(),
                false,
                false,
                timestamp,
            );
        }
        Operation::SetDisplayName { user_index, value } => {
            let user_id = get_from_map(&members.members_and_channels, user_index);
            members.set_display_name(user_id, value, timestamp);
        }
        Operation::Remove { user_index } => {
            let user_id = get_from_map(&members.members_and_channels, user_index);
            if members.owners.len() != 1 || members.owners.first() != Some(&user_id) {
                members.remove(&user_id, timestamp);
            }
        }
        Operation::Block { user_index } => {
            let user_id = get_from_map(&members.members_and_channels, user_index);
            if members.owners.len() != 1 || members.owners.first() != Some(&user_id) {
                members.remove(&user_id, timestamp);
                members.block(user_id, timestamp);
            }
        }
        Operation::Unblock { user_index } => {
            if !members.blocked.is_empty() {
                let user_id = get_from_set(&members.blocked, user_index);
                members.unblock(user_id, timestamp);
            }
        }
        Operation::Lapse { user_index } => {
            let user_id = get_from_map(&members.members_and_channels, user_index);
            members.update_lapsed(user_id, true, timestamp);
        }
        Operation::Unlapse { user_index } => {
            if !members.lapsed.is_empty() {
                let user_id = get_from_set(&members.lapsed, user_index);
                members.update_lapsed(user_id, false, timestamp);
            }
        }
        Operation::UnlapseAll => {
            members.unlapse_all(timestamp);
        }
        Operation::SetSuspended { user_index, suspended } => {
            if suspended {
                let user_id = get_from_map(&members.members_and_channels, user_index);
                members.set_suspended(user_id, true, timestamp);
            } else if !members.suspended.is_empty() {
                let user_id = get_from_set(&members.suspended, user_index);
                members.set_suspended(user_id, false, timestamp);
            }
        }
    };
}

fn get_from_map<V>(map: &BTreeMap<UserId, V>, index: usize) -> UserId {
    let index = index % map.len();
    map.iter().nth(index).map(|(u, _)| *u).unwrap()
}

fn get_from_set(set: &BTreeSet<UserId>, index: usize) -> UserId {
    let index = index % set.len();
    set.iter().nth(index).copied().unwrap()
}

fn principal(index: usize) -> Principal {
    Principal::from_slice(&index.to_be_bytes())
}

fn user_id(index: usize) -> UserId {
    principal(index).into()
}

fn role(value: usize) -> CommunityRole {
    let index = value % 3;

    match index {
        0 => CommunityRole::Owner,
        1 => CommunityRole::Admin,
        2 => CommunityRole::Member,
        _ => unreachable!(),
    }
}
