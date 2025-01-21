import {
    Actor,
    bufFromBufLike,
    Certificate,
    HttpAgent,
    type Identity,
    lookupResultToBuffer,
    polling,
    ReplicaTimeError,
    QueryCallRejectedError,
    UpdateCallRejectedError,
} from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import {
    AuthError,
    DestinationInvalidError,
    ResponseTooLargeError,
    SessionExpiryError,
} from "openchat-shared";
import { ReplicaNotUpToDateError, toCanisterResponseError } from "./error";
import { type Options, Packr } from "msgpackr";
import type { Static, TSchema } from "@sinclair/typebox";
import { AssertError, Value } from "@sinclair/typebox/value";

const MAX_RETRIES = process.env.NODE_ENV === "production" ? 7 : 3;
const RETRY_DELAY = 100;

function debug(msg: string): void {
    console.log(msg);
}

const Packer = new Packr({
    useRecords: false,
    skipValues: [undefined],
    largeBigIntToString: true,
} as unknown as Options);

export abstract class CandidService {
    protected createServiceClient<T>(factory: IDL.InterfaceFactory): T {
        return Actor.createActor<T>(factory, {
            agent: this.agent,
            canisterId: this.canisterId,
        });
    }

    protected get principal(): Principal {
        return this.identity.getPrincipal();
    }

    protected async executeMsgpackQuery<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        const payload = CandidService.prepareMsgpackArgs(args, requestValidator);

        return await this.handleQueryResponse(
            () =>
                this.agent.query(this.canisterId, {
                    methodName: methodName + "_msgpack",
                    arg: payload,
                }),
            (resp) => {
                if (resp.status === "replied") {
                    return Promise.resolve(
                        CandidService.processMsgpackResponse(
                            resp.reply.arg,
                            mapper,
                            responseValidator,
                        ),
                    );
                } else {
                    throw new QueryCallRejectedError(
                        Principal.fromText(this.canisterId),
                        methodName,
                        resp,
                    );
                }
            },
            args,
        );
    }

    protected async executeMsgpackUpdate<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
        onRequestAccepted?: () => void,
    ): Promise<Out> {
        const payload = CandidService.prepareMsgpackArgs(args, requestValidator);

        try {
            const { requestId, response } = await this.sendRequestToCanister(() =>
                this.agent.call(this.canisterId, {
                    methodName: methodName + "_msgpack",
                    arg: payload,
                    callSync: onRequestAccepted === undefined,
                }),
            );
            const canisterId = Principal.fromText(this.canisterId);
            const responseCertificate = response.body?.certificate;

            // If the response is valid it will either contain the certificate or a 202 Accepted response code
            const rejected = !response.ok || (response.status === 200 && !responseCertificate);

            if (rejected) {
                throw new UpdateCallRejectedError(canisterId, methodName, requestId, response);
            }

            if (responseCertificate) {
                const certTime = this.agent.replicaTime;
                const certificate = await Certificate.create({
                    certificate: bufFromBufLike(responseCertificate),
                    rootKey: this.agent.rootKey,
                    canisterId: Principal.from(canisterId),
                    certTime,
                });
                const path = [new TextEncoder().encode("request_status"), requestId];
                const status = new TextDecoder().decode(
                    lookupResultToBuffer(certificate.lookup([...path, "status"])),
                );

                switch (status) {
                    case "replied": {
                        const reply = lookupResultToBuffer(certificate.lookup([...path, "reply"]));
                        if (reply) {
                            return Promise.resolve(
                                CandidService.processMsgpackResponse(
                                    reply,
                                    mapper,
                                    responseValidator,
                                ),
                            );
                        }
                        break;
                    }
                    case "rejected":
                        throw new UpdateCallRejectedError(
                            canisterId,
                            methodName,
                            requestId,
                            response,
                        );
                }
            }

            // If we reach here the response code must be 202 Accepted, so we should start polling
            if (onRequestAccepted !== undefined) {
                onRequestAccepted();
            }

            const { reply } = await this.sendRequestToCanister(() =>
                polling.pollForResponse(
                    this.agent,
                    canisterId,
                    requestId,
                    polling.defaultStrategy(),
                ),
            );
            return Promise.resolve(
                CandidService.processMsgpackResponse(reply, mapper, responseValidator),
            );
        } catch (err) {
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        }
    }

    protected handleResponse<From, To>(
        service: Promise<From>,
        mapper: (from: From) => To,
        args?: unknown,
    ): Promise<To> {
        return service.then(mapper).catch((err) => {
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        });
    }

    protected handleQueryResponse<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To | Promise<To>,
        args?: unknown,
        retries = 0,
    ): Promise<To> {
        return this.sendRequestToCanister(() => serviceCall())
            .then(mapper)
            .catch((err) => {
                const responseErr = toCanisterResponseError(err as Error, this.identity);
                const debugInfo = `error: ${JSON.stringify(
                    responseErr,
                    Object.getOwnPropertyNames(responseErr),
                )}, args: ${JSON.stringify(args)}`;
                if (
                    !(responseErr instanceof ResponseTooLargeError) &&
                    !(responseErr instanceof SessionExpiryError) &&
                    !(responseErr instanceof DestinationInvalidError) &&
                    !(responseErr instanceof AuthError) &&
                    retries < MAX_RETRIES
                ) {
                    const delay = RETRY_DELAY * Math.pow(2, retries);

                    if (responseErr instanceof ReplicaNotUpToDateError) {
                        debug(
                            `query: replica not up to date, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`,
                        );
                    } else {
                        debug(
                            `query: error occurred, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`,
                        );
                    }

                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            this.handleQueryResponse(serviceCall, mapper, args, retries + 1)
                                .then(resolve)
                                .catch(reject);
                        }, delay);
                    });
                } else {
                    debug(
                        `query: Error performing query request, exiting retry loop. retries: ${retries}. ${debugInfo}`,
                    );
                    throw responseErr;
                }
            });
    }

    private async sendRequestToCanister<T>(
        requestFn: () => Promise<T>,
        isRetry = false,
    ): Promise<T> {
        try {
            return await requestFn();
        } catch (err) {
            if (!isRetry && err instanceof ReplicaTimeError) {
                this.agent.replicaTime = err.replicaTime;
                console.log("Set replica time to " + err.replicaTime);
                return await this.sendRequestToCanister(requestFn, true);
            }
            throw err;
        }
    }

    private static validate<T extends TSchema>(value: unknown, validator: T): Static<T> {
        return Value.Parse(validator, value);
    }

    private static prepareMsgpackArgs<T extends TSchema>(
        value: Static<T>,
        validator: T,
    ): ArrayBuffer {
        const validated = CandidService.validate(value, validator);
        return Packer.pack(validated);
    }

    private static processMsgpackResponse<Resp extends TSchema, Out>(
        responseBytes: ArrayBuffer,
        mapper: (from: Static<Resp>) => Out,
        validator: Resp,
    ): Out {
        const response = Packer.unpack(new Uint8Array(responseBytes));
        try {
            const validated = CandidService.validate(response, validator);
            return mapper(validated);
        } catch (err) {
            console.error(
                "Validation failed for response: ",
                response,
                err instanceof AssertError ? err.error : undefined,
            );
            throw err;
        }
    }

    constructor(
        protected identity: Identity,
        protected agent: HttpAgent,
        protected canisterId: string,
    ) {}
}
