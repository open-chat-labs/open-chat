import { Option, Timestamp } from "../../domain/model/common";
import addAnswers, { AddAnswersRequest } from "./addAnswers";
import addOffers, { AddOffersRequest, AddOffersResponse } from "./addOffers";
import getConnectionDetails, { GetConnectionDetailsResponse } from "./getConnectionDetails";
import removeConnectionDetails, { RemoveConnectionDetailsRequest } from "./removeConnectionDetails";

export default class service {
    public static addOffers(request: AddOffersRequest) : Promise<AddOffersResponse> {
        return addOffers(request);
    }

    public static addAnswers(request: AddAnswersRequest) : Promise<void> {
        return addAnswers(request);
    }

    public static async getConnectionDetails(updatedSince: Option<Timestamp>, deleteAfterRetrieval: boolean = true) : Promise<GetConnectionDetailsResponse> {
        const response = await getConnectionDetails(updatedSince);

        if (deleteAfterRetrieval && response.connections.length) {
            removeConnectionDetails({
                connections: response.connections.map(c => ({
                    userId: c.userId,
                    id: c.id
                }))
            });
        }

        return response;
    }

    public static removeConnectionDetails(request: RemoveConnectionDetailsRequest) : Promise<number> {
        return removeConnectionDetails(request);
    }
}
