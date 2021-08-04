use ic_cdk::api::call::CallResult;
use log::error;
use shared::generate_c2c_call;
use shared::types::CanisterId;

pub mod queries {
    use super::*;
    use group_index_canister::queries::*;

    generate_c2c_call!(active_groups);
}

pub mod updates {
    use super::*;
    use group_index_canister::updates::*;

    generate_c2c_call!(create_group);
    generate_c2c_call!(notify_activity);
}
