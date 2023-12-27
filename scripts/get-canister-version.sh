#!/bin/bash

# This script finds the first canister release version that is lower than or equal to the tag passed in.
# eg. `./get-canister-version.sh user v2.0.900-market-maker` outputs `v2.0.890-user`

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
TAG=$2

MAX_VERSION=${TAG/#v}
MAX_VERSION=(${MAX_VERSION//-/ })

git fetch -tfq origin master

# Taken from https://stackoverflow.com/a/4025065
vercomp () {
    if [[ $1 == $2 ]]
    then
        return 0
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    # fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++))
    do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++))
    do
        if [[ -z ${ver2[i]} ]]
        then
            # fill empty fields in ver2 with zeros
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]}))
        then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]}))
        then
            return 2
        fi
    done
    return 0
}

for TAG in $(git tag -l --sort=-version:refname "*-$CANISTER_NAME")
do
    VERSION=${TAG/#v}
    VERSION=(${VERSION//-/ })

    vercomp $MAX_VERSION $VERSION

    if [[ $? -le 1 ]]
    then
        echo $TAG
        exit
    fi
done


