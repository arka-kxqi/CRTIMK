import {
    Bounty,
    ClientConfig,
    CoordinatorContract,
    SupportedFileDownloadProtocols,
    ChainEvent,
    BountyCreatedEvent, BountyCompletedEvent
} from "./types";
import {Account, connect, Contract} from "near-api-js";
import {logger} from "./logger";
import {BountyNotFoundError} from "./errors";
import axios, {AxiosResponse} from "axios";

export const MAX_GAS="300000000000000"
export const getAccount = async (config: ClientConfig, accountId: string): Promise<Account> => {
    const nearConnection = await connect(config.nearConnection);
    logger.debug(`fetching account from ${config.nearConnection.networkId}`)
    const account = await nearConnection.account(accountId);
    logger.info(`Connected to NEAR account: ${account.accountId}, balance: ${await account.getAccountBalance()}`);
    return account;
}

export const getCoordinatorContract = async (config: ClientConfig, account: Account): Promise<CoordinatorContract> => {
    logger.info(`Connecting to coordinator contract at ${config.coordinatorContractId}`);
    let contract = new Contract(
        account, // the account object that is connecting TODO is this required?
        config.coordinatorContractId, // the contract id
        {
            // make sure the ContractCoordinator type matches the contract
            viewMethods: ["get_bounty", "should_post_answer", "get_node", "get_answer"], // view methods do not change state but usually return a value
            changeMethods: ["post_answer", "create_bounty", "collect_reward", "register_node", "reject_bounty"], // change methods modify state, or otherwise require gas (such as when using borsh result_serializer)
        }
    );
    logger.info(`Connected to coordinator contract at ${config.coordinatorContractId}`, contract);
    return contract as CoordinatorContract;
}

export const getBounty = async (config: ClientConfig, coordinatorContract: CoordinatorContract, bountyId: string): Promise<Bounty> => {
    logger.debug(`Downloading bounty data for ${bountyId} from chain`)
    logger.info(`Downloading bounty data for ${bountyId} from chain`)
    // formatNEAR()
    const bounty: Bounty = await coordinatorContract.get_bounty({
            bounty_id: bountyId
        }
    );
    if (!bounty) {
        throw new BountyNotFoundError(`Bounty ${bountyId} not found in coordinator contract ${config.coordinatorContractId}`)
    }
    logger.debug(`Retrieved bounty:`, bounty)
    return bounty;
}

type SupportedPlaceholders = {
    NODE_NAME?: string,
    NODE_ID?: string,
    BOUNTY_ID?: string,
    ACCOUNT_ID?: string
    TIMESTAMP?: string,
    HOME?: string,
}

/*
Used to populate placeholders like $NODE_ID and $BOUNTY_ID in strings.
*/
export const fillPlaceholders = (input: string, placeholders: SupportedPlaceholders): string => {
    let base = input;
    //Important to check undefined in case we don't have a value yet. Ex: We know NODE_ID much earlier than BOUNTY_ID
    base = placeholders.NODE_NAME ? base.replace("$NODE_NAME", placeholders.NODE_NAME) : base
    base = placeholders.NODE_ID ? base.replace("$NODE_ID", placeholders.NODE_ID) : base
    base = placeholders.BOUNTY_ID ? base.replace("$BOUNTY_ID", placeholders.BOUNTY_ID) : base
    base = placeholders.ACCOUNT_ID ? base.replace("$ACCOUNT_ID", placeholders.ACCOUNT_ID) : base
    base = placeholders.TIMESTAMP ? base.replace("$TIMESTAMP", placeholders.TIMESTAMP) : base
    base = placeholders.HOME ? base.replace("$HOME", placeholders.HOME) : base
    logger.debug(`Filled placeholders in ${input} to ${base}`)
    return base
}

/*
Used to emit a bounty every X milliseconds. Useful for testing and development, but will always cost gas in production since the bounty creator is the bounty owner
*/

const createBounty = async (config: ClientConfig, coordinatorContract: CoordinatorContract) => {
    const amtStorage = BigInt(process.env.EMIT_BOUNTY__AMT_STORAGE || "1000000000000000000000000")
    const amtReward = BigInt(process.env.EMIT_BOUNTY__AMT_NODE_REWARD || "1000000000000000000000000")
    const deposit = (amtStorage + amtReward).toString()

    const name = `${process.env.EMIT_BOUNTY__NAME || "test-bounty"}-${Math.floor(Date.now() / 1000)}`
    logger.info(`Creating new bounty: ${name}`)
    const bounty = await coordinatorContract.create_bounty({
            file_location: process.env.EMIT_BOUNTY__FILE_LOCATION || 'https://github.com/ad0ll/docker-hello-world.git',
            file_download_protocol: SupportedFileDownloadProtocols.GIT,
            min_nodes: parseInt(process.env.EMIT_BOUNTY__MIN_NODES || "2"),
            timeout_seconds: parseInt(process.env.EMIT_BOUNTY__TIMEOUT_SECONDS || "60"), //1 minute
            network_required: process.env.EMIT_BOUNTY__NETWORK_REQUIRED !== "false",
            gpu_required: process.env.EMIT_BOUNTY__GPU_REQUIRED !== "false",
            amt_storage: amtStorage.toString(),
            amt_node_reward: amtReward.toString(),
        },
        MAX_GAS,
        deposit.toString()
    )
    logger.info(`automatically created bounty ${bounty.id}`, bounty)
    if (process.env.EMIT_BOUNTY__PUBLISH_CREATE_EVENT) {
        logger.info(`Publishing bounty created event for ${bounty.id}`
        )
        const bce: BountyCreatedEvent = {
            event: "bounty_created",
            data: {
                coordinator_id: config.coordinatorContractId,
                node_ids: bounty.elected_nodes,
                bounty_id: bounty.id
            }
        }
        const sanity_check =  await coordinatorContract.get_bounty({bounty_id: bounty.id})
        console.log("sanity check", sanity_check)
        await publishEventToWebsocketRelay(bounty.id, bce)
    }

    return bounty
}
//Dev only, used to publish a message to the websocket relay for when you don't have an indexer that can send events
export const publishEventToWebsocketRelay = async (bounty_id: string, eventData: BountyCreatedEvent | BountyCompletedEvent): Promise<AxiosResponse> => {
        const event = generatePlaceholderChainEvent(eventData)
        const bountyEmitterUrl = process.env.EMIT_BOUNTY__WS_RELAY_URL || "http://127.0.0.1:8000/publish"
        logger.info(`Posting bounty ${bounty_id} to bounty emitter at ${bountyEmitterUrl}`)
        return axios.post(bountyEmitterUrl, event)
}

export const generatePlaceholderChainEvent = (event: BountyCreatedEvent | BountyCompletedEvent): ChainEvent => {
    return {
        block_height: 0,
        block_hash: "bseefewiwi",
        block_timestamp: 567778870005,
        block_epoch_id: "esesiwiwiw",
        receipt_id: "esefeferer",
        log_index: 0,
        predecessor_id: "esesiwiw",
        account_id: "esesewiwi",
        status: "Success",
        event: JSON.stringify(event)
    }
}

export const emitBounty = async (config: ClientConfig, coordinatorContract: CoordinatorContract, emitInterval: number) => {
//Lots of would-be-debug logs are at info since you can't get here accidentally
    logger.info(`EMIT_BOUNTY has been set by the user. Client will create a bounty against ${config.nearConnection.networkId} every ${emitInterval}ms`)

    const bounty = await createBounty(config, coordinatorContract)
    setInterval(createBounty, emitInterval, config, coordinatorContract)
}
