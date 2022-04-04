const WASM_PAGE_SIZE_BYTES: u64 = 64 * 1024;

pub fn write_to_stable_memory(offset: u64, bytes: &[u8]) {
    if bytes.is_empty() {
        return;
    }

    let bytes_required = offset + bytes.len() as u64;
    let pages_required = (bytes_required + WASM_PAGE_SIZE_BYTES - 1) / WASM_PAGE_SIZE_BYTES;
    let current_stable_memory_pages = ic_cdk::api::stable::stable64_size();
    let additional_pages_required = pages_required.saturating_sub(current_stable_memory_pages);

    if additional_pages_required > 0 {
        ic_cdk::api::stable::stable64_grow(additional_pages_required).unwrap();
    }

    ic_cdk::api::stable::stable64_write(offset, bytes);
}
