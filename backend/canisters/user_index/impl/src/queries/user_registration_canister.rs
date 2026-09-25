use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_index_canister::user_registration_canister::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn user_registration_canister(_args: Args) -> Response {
    read_state(user_registration_canister_impl)
}

fn user_registration_canister_impl(state: &RuntimeState) -> Response {
    // New users go into MultiUser canisters once they are enabled, so route them to the
    // LocalUserIndex controlling the one with the fewest users. That LocalUserIndex then picks
    // whichever of its own has the fewest, since its counts may be more up to date than ours
    let multi_user_local_user_index = if state.data.multi_user_canisters_enabled {
        state
            .data
            .multi_user_canisters
            .local_user_index_for_new_user(|c| state.data.local_index_map.is_accepting_users(c))
    } else {
        None
    };

    if let Some(canister_id) = multi_user_local_user_index.or_else(|| state.data.local_index_map.index_for_new_user()) {
        Success(canister_id)
    } else {
        NewRegistrationsClosed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use candid::Principal;
    use types::{BuildVersion, CanisterId, MAX_USER_INDEX, UserId};
    use utils::env::test::TestEnv;

    #[test]
    fn routes_to_the_multi_user_canister_with_the_fewest_users_once_enabled() {
        let [quiet, busy] = [canister_id(1), canister_id(2)];
        let [fewer, more] = [canister_id(11), canister_id(12)];
        let mut state = RuntimeState::new(Box::new(TestEnv::default()), Data::default());
        let data = &mut state.data;
        data.local_index_map.add_index(quiet, BuildVersion::min());
        data.local_index_map.add_index(busy, BuildVersion::min());
        // `busy` has more users, so is only chosen for its MultiUser canister
        for index in 1..=3 {
            data.local_index_map.add_user(busy, UserId::new_indexed(more, index));
        }
        data.multi_user_canisters.add(more, quiet, 0);
        data.multi_user_canisters.add(fewer, busy, 0);
        for index in 1..=3 {
            data.multi_user_canisters.on_user_added(&UserId::new_indexed(more, index));
        }
        data.multi_user_canisters.on_user_added(&UserId::new_indexed(fewer, 1));

        let registration_canister = |state: &RuntimeState| match user_registration_canister_impl(state) {
            Success(canister_id) => Some(canister_id),
            _ => None,
        };

        assert_eq!(registration_canister(&state), Some(quiet));

        state.data.multi_user_canisters_enabled = true;
        assert_eq!(registration_canister(&state), Some(busy));

        // A full MultiUser canister is skipped, however few users it holds
        state
            .data
            .multi_user_canisters
            .on_user_added(&UserId::new_indexed(fewer, MAX_USER_INDEX));
        assert_eq!(registration_canister(&state), Some(quiet));

        // And once none can be used, the LocalUserIndex with the fewest users is chosen as before
        state.data.local_index_map.get_mut(&quiet).unwrap().mark_full();
        assert_eq!(registration_canister(&state), Some(busy));
    }

    fn canister_id(i: u64) -> CanisterId {
        Principal::from_slice(&[&i.to_be_bytes()[..], &[1, 1]].concat())
    }
}
