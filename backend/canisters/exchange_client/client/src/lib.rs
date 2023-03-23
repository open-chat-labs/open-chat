use canister_client_macros::*;
use exchange_client_canister::*;

// Queries
generate_query_call!(list_exchanges);

// Update
generate_update_call!(cancel_orders);
generate_update_call!(make_orders);
