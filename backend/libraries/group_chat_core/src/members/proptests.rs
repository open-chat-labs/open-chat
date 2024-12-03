use crate::{GroupMembers, GroupRoleInternal};
use candid::Principal;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use ic_stable_structures::DefaultMemoryImpl;
use proptest::collection::vec as pvec;
use proptest::prelude::*;
use proptest::prop_oneof;
use std::collections::BTreeSet;
use test_strategy::proptest;
use types::{EventIndex, GroupPermissions, MessageIndex, MultiUserChat, TimestampMillis, UserId, UserType};

#[derive(Debug, Clone)]
enum Operation {
    Add {
        user_id: UserId,
    },
    ChangeRole {
        owner_index: usize,
        user_index: usize,
        role: GroupRoleInternal,
    },
    Remove {
        user_index: usize,
    },
    ToggleMuteNotifications {
        user_index: usize,
        mute: bool,
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
        50 => any::<usize>().prop_map(|user_index| Operation::Add { user_id: user_id(user_index) }),
        20 => (any::<usize>(), any::<usize>(), any::<usize>())
            .prop_map(|(owner_index, user_index, role_index)| Operation::ChangeRole { owner_index, user_index, role: role(role_index) }),
        10 => (any::<usize>(), any::<bool>()).prop_map(|(user_index, mute)| Operation::ToggleMuteNotifications { user_index, mute }),
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
fn comprehensive(#[strategy(pvec(operation_strategy(), 100..5_000))] ops: Vec<Operation>) {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init(memory.get(MemoryId::new(1)));

    let mut members = GroupMembers::new(
        user_id(0),
        UserType::User,
        MultiUserChat::Group(Principal::anonymous().into()),
        0,
    );

    let mut timestamp = 1000;
    for op in ops.into_iter() {
        execute_operation(&mut members, op, timestamp);
        timestamp += 1000;
    }

    members.check_invariants(false);
    members.check_invariants(true);
}

fn execute_operation(members: &mut GroupMembers, op: Operation, timestamp: TimestampMillis) {
    match op {
        Operation::Add { user_id } => {
            members.add(
                user_id,
                timestamp,
                EventIndex::default(),
                MessageIndex::default(),
                false,
                UserType::User,
            );
        }
        Operation::ChangeRole {
            owner_index,
            user_index,
            role,
        } => {
            let owner = get(&members.owners, owner_index);
            let user_id = get(&members.member_ids, user_index);
            members.change_role(owner, user_id, role, &GroupPermissions::default(), false, false, timestamp);
        }
        Operation::ToggleMuteNotifications { user_index, mute } => {
            let user_id = get(&members.member_ids, user_index);
            members.toggle_notifications_muted(user_id, mute, timestamp);
        }
        Operation::Remove { user_index } => {
            let user_id = get(&members.member_ids, user_index);
            if members.owners.len() != 1 || members.owners.first() != Some(&user_id) {
                members.remove(user_id, timestamp);
            }
        }
        Operation::Block { user_index } => {
            let user_id = get(&members.member_ids, user_index);
            if members.owners.len() != 1 || members.owners.first() != Some(&user_id) {
                members.remove(user_id, timestamp);
                members.block(user_id, timestamp);
            }
        }
        Operation::Unblock { user_index } => {
            if !members.blocked.is_empty() {
                let user_id = get(&members.blocked, user_index);
                members.unblock(user_id, timestamp);
            }
        }
        Operation::Lapse { user_index } => {
            let user_id = get(&members.member_ids, user_index);
            members.update_lapsed(user_id, true, timestamp);
        }
        Operation::Unlapse { user_index } => {
            if !members.lapsed.is_empty() {
                let user_id = get(&members.lapsed, user_index);
                members.update_lapsed(user_id, false, timestamp);
            }
        }
        Operation::UnlapseAll => {
            members.unlapse_all(timestamp);
        }
        Operation::SetSuspended { user_index, suspended } => {
            if suspended {
                let user_id = get(&members.member_ids, user_index);
                members.set_suspended(user_id, true, timestamp);
            } else if !members.suspended.is_empty() {
                let user_id = get(&members.suspended, user_index);
                members.set_suspended(user_id, false, timestamp);
            }
        }
    };
}

fn get(set: &BTreeSet<UserId>, index: usize) -> UserId {
    let index = index % set.len();
    *set.iter().nth(index).unwrap()
}

fn user_id(index: usize) -> UserId {
    Principal::from_slice(&index.to_be_bytes()).into()
}

fn role(value: usize) -> GroupRoleInternal {
    let index = value % 4;

    match index {
        0 => GroupRoleInternal::Owner,
        1 => GroupRoleInternal::Admin,
        2 => GroupRoleInternal::Moderator,
        3 => GroupRoleInternal::Member,
        _ => unreachable!(),
    }
}
