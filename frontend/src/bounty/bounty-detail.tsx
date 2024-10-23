import React, { Suspense, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  CircularProgress,
  Grid,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import { Bounty } from "../../../execution-client/types";
import {COORDINATOR_ID, WalletContext} from "../app";
import { yoctoNear } from "../common/near-wallet";
import IosShareIcon from "@mui/icons-material/IosShare";
import { exportBounty } from "./existing-bounty";
import useWebSocket from "react-use-websocket";
import axios from "axios";

export const BountyDetail: React.FC = () => {
  const wallet = useContext(WalletContext);
  const { id } = useParams(); //Gets :id from the url
  const [loading, setLoading] = useState(true);
  const [bounty, setBounty] = useState<Bounty>();
  // const localNode: NodeStorage = storage.get("nodes")[id] || {}
  console.log(id);

  if (!id) {
    return (
      <>
        <Typography variant="h3">
          Could not find a bounty ID in the URL
        </Typography>
      </>
    );
  }

  useEffect(() => {
    if (!bounty) {
      const getNode = async () => {
        console.log(`fetching bounty with id ${id}`);
        const fetchedBounty = await wallet.getBounty(id);
        setBounty(fetchedBounty);
        setLoading(false);
      };
      getNode();
    }
  }, [id]);
  const GridLi: React.FC<{ title: string; content: string }> = ({
    title,
    content,
  }) => {
    return (
      <ListItem>
        <Grid container>
          <Grid item xs={6}>
            <Typography variant="h6">{title}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body1">{content}</Typography>
          </Grid>
        </Grid>
      </ListItem>
    );
  };

  if (!bounty && loading) {
    return (
      <Typography variant={"h3"}>
        Fetching bounty <CircularProgress />
      </Typography>
    );
  } else if (!bounty && !loading) {
    return (
      <Typography variant={"h3"}>Could not find bounty with id {id}</Typography>
    );
  }

  console.log(bounty)

  const publishUrl = "http://localhost:8000/publish";
  return (
    <Suspense fallback={<div />}>
      <Typography variant="h3">
        {bounty.id}

        <Button
            variant="contained"
            color="secondary"
            sx={{ float: "right" }}
            startIcon={<IosShareIcon />}
            onClick={() => {
              //TODO DELETE ME BEFORE SUBMIT
              const ev = {
                block_height: 0,
                block_hash: "bseefewiwi",
                block_timestamp: 567778870005,
                block_epoch_id: "esesiwiwiw",
                receipt_id: "esefeferer",
                log_index: 0,
                predecessor_id: "esesiwiw",
                account_id: "esesewiwi",
                status: "Success",
                event: JSON.stringify({
                  event: "bounty_created",
                  data: {
                    coordinator_id: COORDINATOR_ID,
                    node_ids: bounty.elected_nodes,
                    bounty_id: bounty.id
                  }
                })
              }
              axios.post(publishUrl, ev).then((res) => {
                console.log(`finished publishing: `, res)
              })
            }}
        >
          Emit to relay
        </Button>
        <Button
          variant="contained"
          color="secondary"
          sx={{ float: "right" }}
          startIcon={<IosShareIcon />}
          onClick={() => {
            exportBounty(bounty);
          }}
        >
          Export
        </Button>
      </Typography>
      <List>
        <GridLi title="File Location" content={bounty.file_location} />
        <GridLi
          title="Download Protocol"
          content={bounty.file_download_protocol}
        />
        <GridLi title="Min Nodes" content={`${bounty.min_nodes}`} />
        <GridLi
          title="Network Required"
          content={`${bounty.network_required}`}
        />
        <GridLi title="GPU Required" content={`${bounty.gpu_required}`} />
        <GridLi
          title="Storage Amount"
          content={`${Number(bounty.amt_storage) / yoctoNear} NEAR`}
        />
        <GridLi
          title="Reward"
          content={`${Number(bounty.amt_node_reward) / yoctoNear} NEAR`}
        />
        <GridLi title="Timeout" content={`${bounty.timeout_seconds} seconds`} />

        <GridLi
            title="Elected Nodes"
            content={`${bounty.elected_nodes.join(", ") || "N/A"}`}
        />
        <GridLi
          title="Successful Nodes"
          content={`${bounty.successful_nodes.join(", ") || "N/A"}`}
        />
        <GridLi
          title="Failed Nodes"
          content={`${bounty.failed_nodes.join(", ") || "N/A"}`}
        />
        <GridLi
            title="Rejected Nodes"
            content={`${bounty.rejected_nodes.join(", ") || "N/A"}`}
        />
        <GridLi title="Status" content={bounty.status} />
      </List>
    </Suspense>
  );
};
