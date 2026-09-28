// The MultiUser canister implements the User canister's API, so is called via `client::user`, other
// than for these
use crate::generate_msgpack_update_call;
use multi_user_canister::{c2c_create_user, c2c_delete_user};

// Updates
generate_msgpack_update_call!(c2c_create_user);
generate_msgpack_update_call!(c2c_delete_user);
