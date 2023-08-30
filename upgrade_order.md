LocalGroupIndex -> Community -> Website -> User

This is because of the new `manage_user_groups` permission.
LocalGroupIndex installs Communities using Candid so LGI before C.
Website reads the permissions from Communities, so C before W.
Website passes permissions in the args to the User canister to create community, so W before U. 