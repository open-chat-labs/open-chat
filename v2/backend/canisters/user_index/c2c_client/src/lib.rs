use canister_client_macros::*;
use ic_cdk::api::call::CallResult;
use slog::error;
use slog_scope::with_logger;
use types::CanisterId;
use user_index_canister::*;

// Queries
generate_c2c_call!(user);

// Updates
generate_c2c_call!(c2c_set_avatar);
