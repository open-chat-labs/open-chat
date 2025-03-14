use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

fn main() {
    generate_candid_method!(storage_bucket, file_info, query);

    generate_candid_method!(storage_bucket, delete_file, update);
    generate_candid_method!(storage_bucket, delete_files, update);
    generate_candid_method!(storage_bucket, forward_file, update);
    generate_candid_method!(storage_bucket, upload_chunk_v2, update);

    let directory = env::current_dir().unwrap().join("tsBindings/storageBucket");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(storage_bucket, file_info);

    generate_ts_method!(storage_bucket, delete_file);
    generate_ts_method!(storage_bucket, delete_files);
    generate_ts_method!(storage_bucket, forward_file);
    generate_ts_method!(storage_bucket, upload_chunk_v2);

    candid::export_service!();
    std::print!("{}", __export_service());
}
