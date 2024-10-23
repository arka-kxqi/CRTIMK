// Answer as stored in the Coordinator
import { ChunkHash } from "near-api-js/lib/providers/provider";
import { ConnectConfig, Contract } from "near-api-js";

export type NodeResponse = {
  solution: string;
  timestamp: string;
  gas_used: BigInt;
  status: NodeResponseStatuses;
};
export enum NodeResponseStatuses {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  REJECT = "REJECT",
}
export enum SupportedFileDownloadProtocols {
  GIT = "GIT",
  HTTPS = "HTTPS",
}
export enum BountyStatuses {
  Pending = "PENDING",
  Failed = "FAILED",
  Success = "SUCCESS",
  Cancelled = "CANCELLED",
}
export enum PayoutStrategies {
  SuccessfulNodes,
  //If min_nodes+ succeeds, only successful nodes should get paid
  FailedNodes,
  //If min_nodes+ fails, only failed nodes should get paid
  AllAnsweredNodes, //If a bounty is cancelled, all nodes should get paid
}

// Must match contract
export type Bounty = {
  id: string;
  owner_id: string;
  coordinator_id: string;
  file_location: string;
  file_download_protocol: SupportedFileDownloadProtocols;
  complete: boolean;
  cancelled: boolean;
  min_nodes: number;
  bounty_created: number;
  network_required: boolean;
  gpu_required: boolean;
  status: BountyStatuses;
  amt_storage: string;
  amt_node_reward: string;
  timeout_seconds: number;
  elected_nodes: string[];
  // upload_strategy: string // Later add support for publishing solution to IPFS
  answers: { [key: string]: NodeResponse };
  build_args: string[]; //Not currently supported by contract, but used by client for tests
  runtime_args: string[]; //Not currently supported by contract, but used by client for tests
  failed_nodes?: string[];
  successful_nodes?: string[];
  unanswered_nodes?: string[];
  rejected_nodes?: string[];
};

// Stored locally in environment variables
export type ClientConfig = {
  // universalTimeout: BigInt, //Universal timeout in MS. Overrules bounty level timeout.
  nodeName: string;
  nodeId: string; //Every client is a node
  accountId: string; //Owner of the node. Must be able to sign transactions with this account.
  websocketUrl: string; // will be localhost or $(TODO ENTER TESTNET URL) in dev, or $(TODO insert mainnet url) in prod
  bountyStorageDir: string; // $BOUNTY_ID and $NODE_ID can be passed as placeholders, and $BOUNTY_ID is required to avoid collisions
  containerNameFormat: string;
  imageNameFormat: string;
  coordinatorContractId: string; // The coordinator contract where bounties and nodes will be fetched
  nearConnection: ConnectConfig;
  storage: {
    dockerPurgeSystemAfterRun: boolean; // Run docker system prune -y after bounty run, which would free up the most resources. Highly not recommended unless dealing with truly minimal storage
    dockerPurgeImagesAfterRun: boolean; // Run docker image prune -y after a bounty run, which should clear unused base images. Potentially significant storage savings, but at the expense of significantly increased network consumption and a major performance hit.
    dockerRemoveContainerAfterRun: boolean; // Remove the container after a bounty run. This should always be true since a container that's finished running can never be reused by the client. However, it's here as an option for debugging if needed.
    dockerRemoveExecutionImageAfterRun: boolean; // Remove the image used to execute a job once it's complete. This will not delete base images like "alpine:latest" or "nodejs:latest" since those can be used to speed up future runs. This should generally be true unless you expect to run the same job multiple times or can afford the storage
    // TODO dockerShouldSandboxVolumeStorage: boolean
    //TODO rejectJobsAtDiskThreshold: number // 0-100 (Will parse int), rejects jobs outright when disk pressure is at or above this threshold. 100 effectively means "don't check". Default is 85.
  };
  // TODO limits: {
  //     maxMemory: number, //Max memory for a run TODO check docker limits
  //     memoryRejectThreshold: number //Reject jobs until memory is below this threshold
  //     memoryDelayThreshold: number //Delay jobs until memory is below this threshold
  //     maxCpu: number, //Max cpu for a run TODO check docker limits
  //     cpuRejectThreshold: number //Reject jobs until memory is below this threshold
  //     memoryDelayThreshold: number //Delay jobs until memory is below this threshold
  // }
};

// Stored on chain
export type NodeConfig = {
  absoluteTimeout: number; //Universal timeout in MS. Overrules bounty level timeout.
  allowGpu: boolean;
  allowNetwork: boolean;
};

export type ClientExecutionContext = {
  config: ClientConfig;
  nodeConfig: NodeConfig;
  bounty: Bounty;
  phase: string;
  imageName: string;
  containerName: string;
  failed: boolean;
  shouldPostAnswer: boolean;
  result: ClientExecutionResult;
  expectedReward: BigInt;
  storage: {
    root: string; // config.bountyStorageDir w/ $BOUNTY_ID placeholder replaced
    filesDir: string; // where git repos are checked out, files are downloaded and unpacked, and the root where bounties are run
    resultDir: string; // where result files are stored, and potentially packaged or uploaded
    packageName: string; //Either filename.zip, filename.git, filename.tar. Extracted from the file url.
    packagePath: string; // filesDir + packageName
    dockerfilePath: string; // filesDir + "Dockerfile"
  };
};

// Node overlaps with @types/node, so this is called ClientNode instead
export type ClientNode = {
  id: string;
  owner_id: string;
  last_run: number;
  last_success: number;
  last_failure: number;
  last_reject: number;
  successful_runs: number;
  failed_runs: number;
  unanswered_runs: number;
  rejected_runs: number;
  allow_network: boolean;
  allow_gpu: boolean;
  absolute_timeout: number;
  registration_time: number;
  lifetime_earnings: string;
};

// Internal answer from an execution that contains additional information for better UX
export type InternalResultStatuses =
  | "SUCCESS"
  | "FAILURE"
  | "UNELECTED"
  | "UNIMPLEMENTED"
  | "ERROR"
  | "TIMEOUT";
export type ClientExecutionResult = {
  result: string;
  message?: string; //Optional field for an error or other message, gets dumped in index
  errorType?: string;
};

export type EventWrapper<EventData> = {
  standard: string;
  version: string;
  event: string;
  data: EventData;
};
type WSEvent<EventData> = {
  secret: string;
  events: [
    {
      block_height: number;
      block_hash: ChunkHash;
      block_timestamp: number;
      block_epoch_id: ChunkHash;
      receipt_id: ChunkHash;
      log_index: number;
      predecessor_id: string;
      account_id: string;
      status: string; //TODO Should this be enum?
      event: EventWrapper<EventData>;
    }
  ];
};

type BountyCreatedEventData = {
  bounty_id: string;
  node_ids: string[];
};

export type CreateBountyArgs = {
  // name: string,
  file_location: string;
  file_download_protocol: SupportedFileDownloadProtocols;
  min_nodes: number;
  timeout_seconds: number;
  network_required: boolean;
  gpu_required: boolean;
  amt_storage: string;
  amt_node_reward: string;
};
//Convenience type to give completions and checks for coordinator contract calls
export type CoordinatorContract = Contract & {
  get_bounty: ({ bounty_id }: { bounty_id: string }) => Promise<Bounty>;
  should_post_answer: ({
    bounty_id,
    node_id,
  }: {
    bounty_id: string;
    node_id: string;
  }) => Promise<boolean>;
  get_node: ({ node_id }: { node_id: string }) => Promise<ClientNode>;
  create_bounty: (
    args: CreateBountyArgs,
    gas: string,
    deposit: string
  ) => Promise<Bounty>;
  collect_reward: ({
    bounty_id,
    node_id,
  }: {
    bounty_id: string;
    node_id: string;
  }) => Promise<void>;
  //Note that this is the "view" version, can only be run when the bounty is complete/cancelled. use call_get_answer to get answers from hot bounties.
  register_node: (
    {
      name,
      absolute_timeout,
      allow_network,
      allow_gpu,
    }: {
      name: string;
      absolute_timeout: number;
      allow_network: boolean;
      allow_gpu: boolean;
    },
    gas: string,
    deposit: string
  ) => Promise<ClientNode>;
  reject_bounty: ({
    bounty_id,
    node_id,
    message,
  }: {
    bounty_id: string;
    node_id: string;
    message: string;
  }) => Promise<void>;
  get_answer: ({
    bounty_id,
    node_id,
  }: {
    bounty_id: string;
    node_id: string;
  }) => Promise<NodeResponse>;
  post_answer: ({
    bounty_id,
    node_id,
    answer,
    message,
    status,
  }: {
    bounty_id: string;
    node_id: string;
    answer: string;
    message?: string;
    status: NodeResponseStatuses;
  }) => Promise<NodeResponse>;
};

export type ChainEvent = {
  block_height: number;
  block_hash: string; //Should this be a hash type?
  block_timestamp: number;
  block_epoch_id: string;
  receipt_id: string;
  log_index: 0;
  predecessor_id: string;
  account_id: string;
  status: "Success" | "Failure";
  event: string;
};

export type BountyCreatedEvent = {
  event: "bounty_created";
  data: {
    coordinator_id: string;
    node_ids: string[];
    bounty_id: string;
  };
};

export type BountyCompletedEvent = {
  event: "bounty_completed";
  data: {
    coordinator_id: string;
    bounty_id: string;
    node_ids: string[];
    payout_node_ids: string[];
    payout_strategy: PayoutStrategies;
    outcome: BountyStatuses;
  };
};
