use canister_client_macros::*;
use storage_bucket_canister::*;

// Queries
generate_candid_c2c_call!(file_status);

// Updates
generate_candid_c2c_call!(c2c_sync_index);
generate_candid_c2c_call!(delete_file);
generate_candid_c2c_call!(delete_files);
generate_candid_c2c_call!(upload_chunk_v2);
