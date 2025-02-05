RED='\033[0;31m'
NC='\033[0m'

# Build worker files and copy the required ones to public for Vite to be able
# to serve them! (Not the nicest solution, but should work; or we get the Vite
# custom server to work.)
npm --prefix ../openchat-worker run build || exit 1
npm --prefix ../openchat-service-worker run build || exit 1

files=( \
    "../openchat-worker/lib/worker.js" \
    "../openchat-service-worker/lib/service_worker.js" \
)

for file in ${files[@]};
do
    echo "Copying file ${file}..."
    if [ -f $file ]; then
        cp $file ./public
    else
        echo -e "${RED}ERROR: ${file} does not exist!${NC}\n"
        exit 1
    fi;
done
