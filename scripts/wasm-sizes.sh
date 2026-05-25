#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd "$SCRIPT_DIR/.."

WASMS_DIR="./wasms"

# Python snippet to extract the code section (ID=10) size from a wasm binary
READ_CODE_SIZE=$(cat <<'PYEOF'
import sys, struct

def read_leb128(data, pos):
    result = 0
    shift = 0
    while True:
        b = data[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        shift += 7
        if not (b & 0x80):
            return result, pos

wasm = open(sys.argv[1], 'rb').read()
# Skip magic (4 bytes) + version (4 bytes)
pos = 8
code_size = None
while pos < len(wasm):
    section_id = wasm[pos]
    pos += 1
    section_size, pos = read_leb128(wasm, pos)
    if section_id == 10:
        code_size = section_size
        break
    pos += section_size
print(code_size if code_size is not None else 0)
PYEOF
)

human_readable() {
    local bytes=$1
    if   (( bytes >= 1048576 )); then printf "%.2f MB" "$(echo "scale=2; $bytes/1048576" | bc)"
    elif (( bytes >= 1024 ));    then printf "%.2f KB" "$(echo "scale=2; $bytes/1024" | bc)"
    else printf "%d B" "$bytes"
    fi
}

printf "%-35s %12s %12s %18s\n" "CANISTER" "ZIPPED" "UNZIPPED" "CODE SECTION"
printf "%-35s %12s %12s %18s\n" "-------" "------" "--------" "------------"

for gz_file in "$WASMS_DIR"/*.wasm.gz; do
    canister=$(basename "$gz_file" .wasm.gz)

    zipped_bytes=$(stat -f%z "$gz_file")

    tmp_wasm=$(mktemp /tmp/wasm_sizes_XXXXXX.wasm)
    gunzip -c "$gz_file" > "$tmp_wasm"
    unzipped_bytes=$(stat -f%z "$tmp_wasm")

    code_bytes=$(python3 -c "$READ_CODE_SIZE" "$tmp_wasm")
    rm -f "$tmp_wasm"

    printf "%-35s %12s %12s %18s\n" \
        "$canister" \
        "$(human_readable $zipped_bytes)" \
        "$(human_readable $unzipped_bytes)" \
        "$(human_readable $code_bytes)"
done

