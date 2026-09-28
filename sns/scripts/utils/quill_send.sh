#!/bin/bash

# Sends a signed message using `quill send`, replacing each large blob (eg. a wasm module) in the displayed message with
# its length and hash, so that the rest of the message (eg. the proposal summary) can be checked before confirming

set -o pipefail

quill send "$@" | perl -MDigest::SHA=sha256_hex -pe '
    BEGIN { $| = 1 }
    s{(blob "([^"]*)")}{
        my ($blob, $bytes) = ($1, $2);
        $bytes =~ s/\\([0-9a-f]{2})/chr(hex($1))/ge;
        length($bytes) > 1024 ? sprintf("blob <%d bytes, sha256: %s>", length($bytes), sha256_hex($bytes)) : $blob
    }ge'
