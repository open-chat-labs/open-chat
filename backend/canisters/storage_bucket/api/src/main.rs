use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(storage_bucket, file_info, query);

    generate_candid_method!(storage_bucket, delete_file, update);
    generate_candid_method!(storage_bucket, delete_files, update);
    generate_candid_method!(storage_bucket, forward_file, update);
    generate_candid_method!(storage_bucket, upload_chunk_v2, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
