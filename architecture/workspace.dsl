workspace "OpenChat" "High-level system architecture diagrams for OpenChat." {

    model {
        user = person "User" "An OpenChat user"
        openChat = softwareSystem "OpenChat" "OpenChat system" "OpenChat" {
            website = container "Web app" "Landing pages and PWA" "TypeScript and Svelte" "Web Browser" {
                httpCache = component "HTTP Cache" "Caches website assets and OpenStorage files"
                serviceWorker = component "Service worker" "Validates API calls to IC, handles web push notifications, handles caching of website assets" "Typescript" "ServiceWorker"
                landingPages = component "Landing pages" "Static landing page content" "Typescript, Svelte"
                pwa = component "Chat app" "Single page progressive web app" "Typescript, Svelte" "PWA"
                indexDB = component "IndexDB" "Large shared async store" "" "Database"
                localStorage = component "Local storage" "Small but fast synchronous store for app" "" "Database"
            }
            userIndex = container "User index" "Global registry of users" "Canister" "Canister"
            groupIndex = container "Group index" "Global registry of groups" "Canister" "Canister"
            users = container "Users" "Canister per user holding links to chats and direct messages" "Canister" "Canister"
            groups = container "Groups" "Canister per group holding messages and members" "Canister" "Canister"
            notifications = container "Notifications" "Maintains notifications and subscriptions" "Canister" "Canister"
            proposalsBot = container "Proposals bot" "Syncs with NNS & SNSs to provide proposal groups" "Canister" "Canister"
            appAssets = container "Assets canister" "Static assets for the chat app" "Canister" "Canister"
            landingPageAssets = container "Landing page assets" "Static assets for the landing pages hosted on AWS with CDN" "AWS s3" "AWS"
            smsRelay = container "SMS relay" "Polls for SMSs and relays to SMS service" "AWS EC2" "AWS"
            notificationsRelay = container "Notification relay" "Polls for notification and sends to web push servers" "AWS EC2" "AWS"
            openStorageIndex = container "OpenStorage Index" "Index for scalable file storage system" "Canister" "Canister"
            openStorageBuckets = container "OpenStorage Buckets" "Data buckets for scalable file storage system" "Canister" "Canister"
            canisters = container "OpenChat Canisters" "All OpenChat canister APIs" "Canister" "Canister"
        }
        userGeek = softwareSystem "UserGeek" "IC based user analytics system"
        ledgers = softwareSystem "IC ledgers" "NNS and SNS accounts and transactions"
        governance = softwareSystem "IC governance" "NNS and SNS neurons and proposals"
        webPushService = softwareSystem "Web push services" "Web push notifications services hosted by most browser providers" "Off chain"
        smsService = softwareSystem "SMS Service" "AWS Simple Notification Service" "Off chain"
        webRTC = softwareSystem "WebRTC" "STUN + Signalling" "Off chain"
        auth = softwareSystem "Authentication providers" "Internet Identity and NFID"

        # relationships between people and software systems
        user -> openChat "Chats using"
        openChat -> webPushService "Pushes notifications"
        openChat -> smsService "Sends SMSs"
        openChat -> ledgers "Reads balances and sends tokens"
        openChat -> governance "Reads proposals and votes"
        
        # relationships to/from containers
        user -> pwa "Uses"
        user -> landingPages "Views"
        website -> openStorageIndex "Discovers bucket"
        website -> openStorageBuckets "Reads/writes files" "" "Update"
        website -> userGeek "Sends anonymous user metrics" "" "Update"
        website -> userIndex "Queries and updates" "" "Update"
        website -> groupIndex "Queries and updates" "" "Update"
        website -> users "Queries and updates" "" "Update"
        website -> groups "Queries and updates" "" "Update"
        website -> appAssets "Loads"
        website -> landingPageAssets "Loads"
        website -> ledgers "Gets balance"
        website -> notifications "Subscribes" "" "Update"
        userIndex -> openStorageIndex "Manages user access" "" "Update"
        userIndex -> users "Creates and updates" "" "Update"
        groupIndex -> userIndex "Looks-up user"
        groupIndex -> groups "Creates" "" "Update"
        notifications -> userIndex "Looks-up user"
        users -> users "Sends message" "" "Update"
        users -> userIndex "Updates" "" "Update"
        users -> groupIndex "Queries and updates" "" "Update"
        users -> notifications "Sends" "" "Update"
        users -> ledgers "Sends tokens" "" "Update"
        users -> governance "Votes" "" "Update"
        users -> groups "Queries and updates" "" "Update"
        groups -> userIndex "Queries"
        groups -> notifications "Sends" "" "Update"
        groups -> ledgers "Sends tokens" "" "Update"
        proposalsBot -> groupIndex "Create group" "" "Update"
        proposalsBot -> groups "Updates proposals" "" "Update"
        proposalsBot -> governance "Reads proposals"
        smsRelay -> userIndex "Polls"
        smsRelay -> smsService "Sends SMSs"
        notificationsRelay -> notifications "Polls"
        notificationsRelay -> webPushService "Sends notifications"
        openStorageBuckets -> openStorageIndex "Sync files" "" "Update"
        openStorageIndex -> openStorageBuckets "Sync users" "" "Update"

        # relationships to/from components
        pwa -> serviceWorker "Loads assets"
        pwa -> serviceWorker "Calls Canister APIs"
        pwa -> httpCache "Reads raw files"
        pwa -> indexDB "Caches API responses"
        pwa -> localStorage "Caches user settings"
        pwa -> webRTC "Signals IP address"
        pwa -> userGeek "Sends user metrics"
        landingPages -> landingPageAssets "Loads service worker + assets"
        landingPages -> serviceWorker "Installs"
        landingPages -> auth "Authenticates with"
        serviceWorker -> appAssets "Loads assets"
        serviceWorker -> canisters "Calls APIs" "" "Update"
        serviceWorker -> indexDB "Caches assets"
        httpCache -> openStorageBuckets "Reads raw files"
    }

    views {
        systemContext openChat "SystemContext" {
            include *
        }
        
        container openChat "Containers" {
            include *
            exclude canisters
        }        
        
        component website "WebsiteComponents" {
            include *
        }        

        styles {
            element "Software System" {
                background #ff8541
                color #000000
            }
            element "OpenChat" {
                background #fec000
                color #000000
            }
            element "PWA" {
                background #673bb7
                color #ffffff
                width 800
                height 600
            }
            element "ServiceWorker" {
                width 800
            }
            element "Off chain" {
                background #08aedb
                color #000000
            }
            element "Person" {
                shape person
                background #ff005c
                color #ffffff
            }
            element "Web Browser" {
                shape WebBrowser
                background #673bb7
                color #ffffff
            }
            element "Database" {
                shape Cylinder
            }
            element "Canister" {
                background #05b09f
                color #000000
            }
            element "AWS" {
            }
            relationship "Update" {
                dashed false
            }
        }
    }
}
