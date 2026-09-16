use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use multi_user_canister::c2c_create_user;
use user_canister::bio;

// Queries
generate_msgpack_query_call!(bio);

// Updates
generate_msgpack_update_call!(c2c_create_user);
