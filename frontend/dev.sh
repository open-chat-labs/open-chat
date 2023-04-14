# usage: make sure that you have pm2 globally installed: npm i -g pm2
# run this script: sh dev.sh
# monitor using: pm2 monit
# restart individual processes with: pm2 restart [app|dfx] 
# restart all with: pm2 restart all
cd ..
pm2 start --name "dfx" "dfx start" 
cd frontend
cd openchat-shared
pm2 start --name "shared" "npm run dev" 
cd ../openchat-agent
pm2 start --name "agent" "npm run dev" 
cd ../openchat-push
pm2 start --name "push" "npm run dev" 
cd ../openchat-worker
pm2 start --name "worker" "npm run dev" 
cd ../openchat-client
pm2 start --name "client" "npm run dev" 
cd ../app

# we delay the starting of the app process to prevent a race condition
sleep 10 && pm2 start --name "app" "npm run dev" 