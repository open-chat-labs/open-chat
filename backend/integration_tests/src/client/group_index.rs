use crate::{generate_query_call, generate_update_call};
use group_index_canister::*;

// Queries
generate_query_call!(search);

// Updates
generate_update_call!(add_local_group_index_canister);
generate_update_call!(delete_frozen_group);
generate_update_call!(freeze_group);
generate_update_call!(unfreeze_group);
