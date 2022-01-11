import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupIndexService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { IGroupIndexClient } from "./groupIndex.client.interface";
import type { GroupSearchResponse } from "../../domain/search/search";
import { groupSearchResponse } from "./mappers";
import type { GroupChatSummary } from "../../domain/chat/chat";
import DRange from "drange";

export class GroupIndexClient extends CandidService implements IGroupIndexClient {
    private groupIndexService: GroupIndexService;

    private constructor(identity: Identity) {
        super(identity);

        this.groupIndexService = this.createServiceClient<GroupIndexService>(
            idlFactory,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "process.env.GROUP_INDEX_CANISTER"
        );
    }

    static create(identity: Identity): IGroupIndexClient {
        return new GroupIndexClient(identity);
    }

    search(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.handleResponse(
            this.groupIndexService.search({
                search_term: searchTerm,
                max_results: maxResults,
            }),
            groupSearchResponse
        );
    }

    getRecommendedGroups(): Promise<GroupChatSummary[]> {
        return new Promise((resolve) => {
            setTimeout(
                () =>
                    resolve([
                        {
                            kind: "group_chat",
                            name: "Dfinity Pioneers",
                            description:
                                'Mostly just idiots talking nonsense to each other about NFTs. Supplemented with people saying "Hi!"',
                            public: true,
                            joined: BigInt(0),
                            minVisibleEventIndex: 0,
                            minVisibleMessageIndex: 0,
                            lastUpdated: BigInt(0),
                            participantCount: 1234,
                            myRole: "previewer",
                            mentions: [],
                            chatId: "123456",
                            readByMe: new DRange(),
                            latestEventIndex: 0,
                            notificationsMuted: false,
                        },
                        {
                            kind: "group_chat",
                            name: "Product feedback",
                            description:
                                "A chance to give feedback about the OpenChat product itself. Let us know what you think.",
                            public: true,
                            joined: BigInt(0),
                            minVisibleEventIndex: 0,
                            minVisibleMessageIndex: 0,
                            lastUpdated: BigInt(0),
                            participantCount: 1234,
                            myRole: "previewer",
                            mentions: [],
                            chatId: "xyz",
                            readByMe: new DRange(),
                            latestEventIndex: 0,
                            notificationsMuted: false,
                        },
                        {
                            kind: "group_chat",
                            name: "Bug reports",
                            description:
                                "Found a bug in OpenChat. Let us know here. Tell us what you were doing, what you expected to happen and what actually happened.",
                            public: true,
                            joined: BigInt(0),
                            minVisibleEventIndex: 0,
                            minVisibleMessageIndex: 0,
                            lastUpdated: BigInt(0),
                            participantCount: 1234,
                            myRole: "previewer",
                            mentions: [],
                            chatId: "efg",
                            readByMe: new DRange(),
                            latestEventIndex: 0,
                            notificationsMuted: false,
                        },
                        {
                            kind: "group_chat",
                            name: "Memes",
                            description: "",
                            public: true,
                            joined: BigInt(0),
                            minVisibleEventIndex: 0,
                            minVisibleMessageIndex: 0,
                            lastUpdated: BigInt(0),
                            participantCount: 1234,
                            myRole: "previewer",
                            mentions: [],
                            chatId: "abc",
                            readByMe: new DRange(),
                            latestEventIndex: 0,
                            notificationsMuted: false,
                        },
                    ]),
                2000
            );
        });
    }
}
