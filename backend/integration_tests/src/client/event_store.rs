use crate::generate_update_call;
use event_store_canister::*;

// Queries
generate_update_call!(events);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::CanisterId;

    pub fn events(
        env: &mut PocketIc,
        sender: Principal,
        event_store_canister_id: CanisterId,
        start: u64,
        length: u64,
    ) -> event_store_canister::EventsResponse {
        super::events(
            env,
            sender,
            event_store_canister_id,
            &event_store_canister::EventsArgs { start, length },
        )
    }
}

mod events {
    use super::*;

    pub type Args = EventsArgs;
    pub type Response = EventsResponse;
}
