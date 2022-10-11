workspace {

    model {
        user = person "User" "An OpenChat user"
        openChat = softwareSystem "OpenChat" "OpenChat system" {
            website = container "oc.app" "Landing pages and PWA" "TypeScript and Svelte" "Web Browser" {
                httpCache = component "HTTP Cache" "Caches website assets and OpenStorage files"
                serviceWorker = component "Service worker" "Validates API calls to IC, handles web push notifications, handles caching of website assets"
                landingPages = component "Landing pages" "Static landing page content"
                pwa = component "Chat app" "Single page progressive web app"
                indexDB = component "IndexDB" "Large shared async store" "" "Database"
                localStorage = component "Local storage" "Small but fast synchronous store for app" "" "Database"
            }
            userIndex = container "User index" "Global registry of users"
            groupIndex = container "Group index" "Global registry of groups"
            users = container "Users" "Canister per user holding links to chats and direct messages"
            groups = container "Groups" "Canister per group holding messages and members"
            notifications = container "Notifications" "Maintains notifications and subscriptions"
            proposalsBot = container "Proposals bot" "Syncs with NNS & SNSs to provide proposal groups"
            appAssets = container "Assets canister" "Static assets for the chat app"
            landingPageAssets = container "Landing page assets" "Static assets for the landing pages hosted on AWS with CDN"
            smsRelay = container "SMS relay" "Exectuable hosted on AWS"
            notificationsRelay = container "Notification relay" "Exectuable hosted on AWS"
        }
        openStorage = softwareSystem "OpenStorage" "IC based scalable storage system"
        webPushService = softwareSystem "Web push notifications" "Web push services hosted by most browser providers" "External"
        smsService = softwareSystem "SMS Service" "AWS Simple Notification Service" "External"
        internetIdentity = softwareSystem "Internet Identity (II)" "Default IC user authentication service"
        nfid = softwareSystem "NFID" "User authentication service built on top of II"
        ledgers = softwareSystem "IC ledgers" "NNS and SNS accounts and transactions"
        governance = softwareSystem "IC governance" "NNS and SNS neurons and proposals"

        # relationships between people and software systems
        user -> openChat "Uses"
        openChat -> openStorage "Read/write files"
        openChat -> webPushService "Push notifications to user's browser"
        openChat -> smsService "Send SMSs"
        openChat -> internetIdentity = "Authenticates with"
        openChat -> nfid = "Authenticates with"
        
        # relationships to/from containers
        user -> pwa "Uses"
        user -> landingPages "Visits"
        website -> openStorage "Stores/reads file attachments"
        website -> userIndex "Queries and updates"
        website -> groupIndex "Queries and updates"
        website -> users "Queries and updates"
        website -> groups "Queries and updates"
        website -> appAssets "Loads"
        website -> landingPageAssets "Loads"
        website -> ledgers "Gets balance"
        userIndex -> openStorage "Manages user access"
        userIndex -> users "Creates"
        groupIndex -> userIndex "Looks-up user"
        groupIndex -> groups "Creates"
        notifications -> userIndex "Looks-up user"
        users -> users "Sends message"
        users -> userIndex "Updates"
        users -> groupIndex "Queries and updates"
        users -> notifications "Sends"
        users -> ledgers "Sends tokens"
        groups -> userIndex "Queries"
        groups -> notifications "Sends"
        groups -> ledgers "Sends tokens"
        groups -> governance "Votes"
        proposalsBot -> groupIndex "Create group"
        proposalsBot -> groups "Updates proposals"
        proposalsBot -> governance "Reads proposals"
        smsRelay -> userIndex "Polls"
        notificationsRelay -> notifications "Polls"

        # relationships to/from components
        pwa -> serviceWorker "Get assets and make API calls"
        landingPages -> serviceWorker "Get assets"
        serviceWorker -> httpCache "Get assets and make API calls"
        serviceWorker -> indexDB "Cache static assets"
        pwa -> indexDB "Cache domain objects"
        pwa -> localStorage "Cache user settings"        
    }

    views {
        systemContext openChat "SystemContext" {
            include *
            autoLayout
        }
        
        container openChat "ocContainers" {
            include *
            autoLayout
        }        
        
        component website "websiteComponents" {
            include *
            autoLayout
        }        

        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
            element "Web Browser" {
                shape WebBrowser
            }
            element "Database" {
                shape Cylinder
            }
        }
    }
}