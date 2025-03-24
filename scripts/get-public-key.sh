IDENTITY=${1:-default}

RESULT=$(dfx --identity $IDENTITY canister call -qq user_index public_key '(record { })' --query) || exit 1

# Use parameter expansion with substring removal to extract the public key
first_part="${RESULT#*-----BEGIN PUBLIC KEY-----}"  # Remove everything up to and including the first "---"
second_part="${first_part%-----END PUBLIC KEY-----*}" # Remove everything from the last "---" to the end
OC_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----$second_part-----END PUBLIC KEY-----\n"

# Echo the public key
echo "$OC_PUBLIC_KEY"
