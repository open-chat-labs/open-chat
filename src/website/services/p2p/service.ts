import { Option, Timestamp } from "../../domain/model/common";
import addAnswer, { AddAnswerRequest, AddAnswerResponse } from "./addAnswer";
import addOffer, { AddOfferRequest, AddOfferResponse } from "./addOffer";
import getConnectionDetails, { GetConnectionDetailsResponse } from "./getConnectionDetails";
import removeConnectionDetails, { RemoveConnectionDetailsRequest } from "./removeConnectionDetails";

export default class service {
    public static addOffer(request: AddOfferRequest) : Promise<AddOfferResponse> {
        return addOffer(request);
    }

    public static addAnswer(request: AddAnswerRequest) : Promise<AddAnswerResponse> {
        return addAnswer(request);
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
