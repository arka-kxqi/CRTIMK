import {ClientConfig} from "./types";
import path from "path";
import os from "os";
import assert from "assert";
import {keyStores} from "near-api-js";
import {logger} from "./logger";
import * as dotenv from 'dotenv'
import {fillPlaceholders} from "./util";
import * as fs from "fs";

dotenv.config()
if(fs.existsSync("./.env.personal")) {
    logger.info("Loading .env.personal")
    dotenv.config({path: ".env.personal", override: true})
}

// Sets up the global config object and does some basic validation
// Items prefixed with NEAR_ are for NEAR api config, anything else is client config
export const readConfigFromEnv = (): ClientConfig => {
    const {
        WEBSOCKET_URL = 'ws://localhost:7071', //TODO Default should be mainnet or testnet
        ACCOUNT_ID = "test1.test.near", //TODO bad dummy value, should be required
        NODE_NAME = "node1",
        NODE_ID = "node1.node.$ACCOUNT_ID", //TODO bad dummy value, should be required
        BOUNTY_STORAGE_DIR = path.join(os.homedir(), ".local/bounty_data/$BOUNTY_ID"),
        COORDINATOR_CONTRACT_ID = "dev-1665283011588-97304367585179",
        DOCKER_CONTAINER_NAME_FORMAT = "bounty-$BOUNTY_ID",
        DOCKER_IMAGE_NAME_FORMAT = "$BOUNTY_ID",
        NEAR_CREDENTIALS_DIR,
        NEAR_NETWORK_ID = "testnet",
        NEAR_NODE_URL = `https://rpc.${NEAR_NETWORK_ID}.near.org`,
        NEAR_WALLET_URL = `https://wallet.${NEAR_NETWORK_ID}.near.org`,
        NEAR_HELPER_URL = `https://helper.${NEAR_NETWORK_ID}.near.org`,
        STORAGE_DOCKER_PRUNE_SYSTEM_EACH_RUN = "false",
        STORAGE_DOCKER_PRUNE_IMAGES_EACH_RUN = "false",
        STORAGE_DOCKER_REMOVE_EXECUTION_CONTAINER_EACH_RUN = "true",
        STORAGE_DOCKER_REMOVE_EXECUTION_IMAGE_EACH_RUN = "true",
    } = process.env;
    logger.info("Bootstrapping client configuration from environment"); /*?*/
    //Set up credentials for near connection
    const credentialsDir = NEAR_CREDENTIALS_DIR || path.join(os.homedir(), ".near-credentials",);
    const keyStore = new keyStores.UnencryptedFileSystemKeyStore(credentialsDir);

    //Create the config object, defaults are assigned when reading envvars
    const config: ClientConfig = {
        websocketUrl: WEBSOCKET_URL,
        // universalTimeout: BigInt(UNIVERSAL_TIMEOUT),
        accountId: ACCOUNT_ID,
        nodeName: NODE_NAME,
        nodeId: fillPlaceholders(NODE_ID, {NODE_NAME, ACCOUNT_ID}),
        // acceptNetworkWorkloads: ACCEPT_NETWORK_WORKLOADS === "true",
        // acceptGpuWorkloads: ACCEPT_GPU_WORKLOADS === "true",
        bountyStorageDir: fillPlaceholders(BOUNTY_STORAGE_DIR, {ACCOUNT_ID, NODE_ID, HOME: os.homedir()}),
        coordinatorContractId: COORDINATOR_CONTRACT_ID,
        containerNameFormat: fillPlaceholders(DOCKER_CONTAINER_NAME_FORMAT, {ACCOUNT_ID, NODE_ID}),
        imageNameFormat: fillPlaceholders(DOCKER_IMAGE_NAME_FORMAT, {ACCOUNT_ID, NODE_ID}),
        nearConnection: {
            networkId: NEAR_NETWORK_ID,
            keyStore,
            nodeUrl: NEAR_NODE_URL,
            walletUrl: NEAR_WALLET_URL,
            helperUrl: NEAR_HELPER_URL,
        },
        storage: {
            dockerPurgeImagesAfterRun: STORAGE_DOCKER_PRUNE_IMAGES_EACH_RUN === "true",
            dockerPurgeSystemAfterRun: STORAGE_DOCKER_PRUNE_SYSTEM_EACH_RUN === "true",
            dockerRemoveContainerAfterRun: STORAGE_DOCKER_REMOVE_EXECUTION_CONTAINER_EACH_RUN !== "true",
            dockerRemoveExecutionImageAfterRun: STORAGE_DOCKER_REMOVE_EXECUTION_IMAGE_EACH_RUN !== "false" // Default true,
        }
    }
    logger.debug(`Validating specific configuration elements`); //?
    assert(config.bountyStorageDir.includes("$BOUNTY_ID"), "The $BOUNTY_ID placeholder must appear in BOUNTY_STORAGE_DIR to avoid collisions")
    logger.debug("Finished bootstrapping client configuration:", config); /*?*/
    return config

}