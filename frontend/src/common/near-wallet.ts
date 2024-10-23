// near api js
import { providers } from "near-api-js";
// wallet selector UI
import "@near-wallet-selector/modal-ui/styles.css";
import { setupModal } from "@near-wallet-selector/modal-ui";
import LedgerIconUrl from "@near-wallet-selector/ledger/assets/ledger-icon.png";
import NearIconUrl from "@near-wallet-selector/near-wallet/assets/near-wallet-icon.png";
import MyNearIconUrl from "@near-wallet-selector/my-near-wallet/assets/my-near-wallet-icon.png";

// wallet selector options
import {
  setupWalletSelector,
  Wallet as NearWallet,
  WalletSelector,
} from "@near-wallet-selector/core";
import { setupLedger } from "@near-wallet-selector/ledger";
import { setupNearWallet } from "@near-wallet-selector/near-wallet";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { CodeResult } from "near-api-js/lib/providers/provider";
import { FinalExecutionOutcome } from "near-api-js/lib/providers";
import { NEAR } from "near-units";
import {COORDINATOR_ID} from "../app";
import { Bounty, ClientNode } from "../../../execution-client/types";

const THIRTY_TGAS = "30000000000000";
const NO_DEPOSIT = "0";
export const yoctoNear = 1000000000000000000000000;

// Wallet that simplifies using the wallet selector
export class Wallet {
  walletSelector: WalletSelector;
  wallet: NearWallet;
  accountId: string;
  contractId: string;

  constructor() {
    this.contractId = COORDINATOR_ID; //COORDINATOR_NAME or COORDINATOR_ID envvar
  }

  // To be called when the website loads
  async startUp() {
    this.walletSelector = await setupWalletSelector({
      network: "testnet",
      // network, //TODO make this configurable, see network config in execution client
      modules: [
        setupNearWallet({ iconUrl: NearIconUrl }),
        setupMyNearWallet({ iconUrl: MyNearIconUrl }),
        setupLedger({ iconUrl: LedgerIconUrl }),
      ],
    });

    const isSignedIn = this.walletSelector.isSignedIn();

    if (isSignedIn) {
      const { accounts } = this.walletSelector.store.getState();
      this.wallet = await this.walletSelector.wallet();
      this.accountId = accounts[0].accountId;
    }
    console.log(this.walletSelector);
    console.log(this.walletSelector.store);
    console.log(this.walletSelector.store.getState());
    console.log(this.accountId);
    console.log(isSignedIn);
    return isSignedIn;
  }

  // Sign-in method
  signIn() {
    const description = "Please select a wallet to sign in.";
    const modal = setupModal(this.walletSelector, {
      contractId: this.contractId,

      description,
    });
    modal.show();
  }

  // Sign-out method
  signOut() {
    this.wallet.signOut();
    this.wallet = this.accountId = this.contractId = undefined;
    // window.location.replace(window.location.origin + window.location.pathname);
  }

  // Make a read-only call to retrieve information from the network
  async viewMethod({ contractId = this.contractId, method, args = {} }) {
    const { network } = this.walletSelector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    let res = await provider.query<CodeResult>({
      request_type: "call_function",
      account_id: contractId,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      finality: "optimistic",
    });
    return JSON.parse(Buffer.from(res.result).toString());
  }

  // Call a method that changes the contract-js's state
  async callMethod({
    contractId = this.contractId,
    method,
    args = {},
    gas = THIRTY_TGAS,
    deposit = NO_DEPOSIT,
  }) {
    const { accountId } = this.walletSelector.store.getState().accounts[0];

    // Sign a transaction with the "FunctionCall" action
    return await this.wallet.signAndSendTransaction({
      signerId: accountId,
      receiverId: contractId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: method,
            args,
            gas,
            deposit,
          },
        },
      ],
    });
  }

  // TODO: Convert human readable KB storage to near storage cost units
  // TOOD: Add pulling conversion from rpc
  async createBounty(bounty: Partial<Bounty>) {
    console.log({
      file_location: bounty.file_location,
      file_download_protocol: bounty.file_download_protocol,
      min_nodes: Number(bounty.min_nodes),
      timeout_seconds: Number(bounty.timeout_seconds),
      network_required: bounty.network_required,
      gpu_required: bounty.gpu_required,
      amt_storage: NEAR.parse(bounty.amt_storage),
      amt_node_reward: NEAR.parse(bounty.amt_node_reward),
    })
    console.log("Calling method")
    await this.callMethod({
      contractId: COORDINATOR_ID,
      method: "create_bounty",
      args: {
        file_location: bounty.file_location,
        file_download_protocol: bounty.file_download_protocol,
        min_nodes: Number(bounty.min_nodes),
        timeout_seconds: Number(bounty.timeout_seconds),
        network_required: bounty.network_required,
        gpu_required: bounty.gpu_required,
        amt_storage: NEAR.parse(bounty.amt_storage),
        amt_node_reward: NEAR.parse(bounty.amt_node_reward),
      },
      deposit: (
        NEAR.parse(bounty.amt_storage).toBigInt() +
        NEAR.parse(bounty.amt_node_reward).toBigInt()
      ).toString(),
    });
    console.log("Fin")
  }

  async cancelBounty(bountyId: string) {
    return await this.callMethod({
      contractId: COORDINATOR_ID,
      method: "cancel_bounty",
      args: { bounty_id: bountyId },
    });
  }

  async addStorage(bountyId: string, deposit: string) {
    return await this.callMethod({
      contractId: COORDINATOR_ID,
      method: "add_storage_deposit",
      args: { bounty_id: bountyId },
      deposit: NEAR.parse(deposit).toString(),
    });
  }

  async addReward(bountyId: string, deposit: string) {
    return await this.callMethod({
      contractId: COORDINATOR_ID,
      method: "add_node_reward_deposit",
      args: { bounty_id: bountyId },
      deposit: NEAR.parse(deposit).toString(),
    });
  }

  // Get transaction result from the network
  async getTransactionResult(txhash: string) {
    const { network } = this.walletSelector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    // Retrieve transaction result from the network
    const transaction = await provider.txStatus(txhash, "unnused");
    return providers.getTransactionLastResult(transaction);
  }

  async getNode(nodeId: string): Promise<ClientNode> {
    return await this.viewMethod({
      method: "get_node",
      args: { node_id: nodeId },
    });
  }

  async getNodesOwnedBySelf(): Promise<ClientNode[]> {
    return await this.viewMethod({
      method: "get_nodes_for_owner",
      args: { owner_id: this.accountId },
    });
  }
  async getLifetimeEarningsForOwner(): Promise<number> {
    return await this.viewMethod({
      method: "get_lifetime_earnings_for_owner",
      args: { owner_id: this.accountId },
    });
  }
  async getNodesOwnedBySelfCount(): Promise<number> {
    return await this.viewMethod({
      method: "get_nodes_for_owner_count",
      args: { owner_id: this.accountId },
    });
  }
  async getNodes(): Promise<ClientNode[]> {
    return await this.viewMethod({
      method: "get_nodes",
    });
  }

  async getBountyResult(bountyId: string): Promise<{ [key: string]: number }> {
    return await this.viewMethod({
      method: "get_bounty_result",
      args: { bounty_id: bountyId },
    });
  }

  async getBounty(bountyId: string): Promise<Bounty> {
    return await this.viewMethod({
      method: "get_bounty",
      args: { bounty_id: bountyId },
    });
  }

  async getBountiesOwnedBySelf(): Promise<Bounty[]> {
    return await this.viewMethod({
      method: "get_bounties_for_owner",
      args: { owner_id: this.accountId },
    });
  }
  async getBountiesOwnedBySelfCount(): Promise<number> {
    return await this.viewMethod({
      method: "get_bounties_for_owner_count",
      args: { owner_id: this.accountId },
    });
  }
  async getBounties(): Promise<Bounty[]> {
    return await this.viewMethod({
      method: "get_bounties",
    });
  }

  async getTotalPayouts(): Promise<number> {
    const result = await this.viewMethod({
      method: "get_total_payouts",
    });
    // console.log("get_total_payouts", result);
    return result;
  }

  async getBountyCount(): Promise<number> {
    const result = await this.viewMethod({
      method: "get_bounty_count",
    });
    // console.log("get_bounty_count", result);
    return result;
  }

  async getNodeCount(): Promise<number> {
    const result = await this.viewMethod({
      method: "get_node_count",
    });
    // console.log("get_node_count", result);
    return result;
  }

  async registerNode(
    name: string,
    absolute_timeout: number,
    allow_network: boolean,
    allow_gpu: boolean
  ): Promise<void | FinalExecutionOutcome> {
    return await this.callMethod({
      contractId: COORDINATOR_ID,
      method: "register_node",
      args: {
        name,
        absolute_timeout: absolute_timeout ? Number(absolute_timeout) : 60000,
        allow_network,
        allow_gpu,
      },
      deposit: NEAR.parse("1").toString(),
    });
  }

  async getBountyAnswerCounts(
    bountyId: string
  ): Promise<{ [key: string]: number }> {
    return await this.viewMethod({
      contractId: COORDINATOR_ID,
      method: "get_bounty_answer_counts",
      args: {
        bounty_id: bountyId,
      },
    });
  }

  async updateNode(
    node_id: string,
    absolute_timeout: string,
    allow_network: boolean,
    allow_gpu: boolean
  ): Promise<void | FinalExecutionOutcome> {
    const node = await this.callMethod({
      method: "update_node",
      args: { node_id, allow_network, allow_gpu, absolute_timeout },
      gas: THIRTY_TGAS,
    });
    return node;
  }

  async removeNode(nodeId) {
    await this.callMethod({
      method: "remove_node",
      args: { node_id: nodeId },
      gas: THIRTY_TGAS,
    });
  }
}
