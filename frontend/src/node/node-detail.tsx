import React, { Suspense, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CircularProgress,
  Grid,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import { ClientNode } from "../../../execution-client/types";

import { nanoTimestampToDate } from "../util";
import { useRecoilValue } from "recoil";
import { localStorageState, WalletContext } from "../app";

export const NodeDetail: React.FC = () => {
  const wallet = useContext(WalletContext);
  const storage = useRecoilValue(localStorageState);
  const { id } = useParams(); //Gets :id from the url
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState<ClientNode>();
  // const localNode: NodeStorage = storage.get("nodes")[id] || {}
  console.log(id);

  if (!id) {
    return (
      <>
        <Typography variant="h3">
          Could not find a node ID in the URL
        </Typography>
      </>
    );
  }

  useEffect(() => {
    if (!node) {
      const getNode = async () => {
        console.log(`fetching node with id ${id}`);
        const fetchedNode = await wallet.getNode(id);
        setNode(fetchedNode);
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

  if (!node && loading) {
    return (
      <Typography variant={"h3"}>
        Fetching node <CircularProgress />
      </Typography>
    );
  } else if (!node && !loading) {
    return (
      <Typography variant={"h3"}>Could not find node with id {id}</Typography>
    );
  }

  return (
    <Suspense fallback={<div />}>
      <Typography variant="h3">{node.id}</Typography>
      <List>
        <GridLi title={"ID"} content={node.id} />
        <GridLi title={"Owner"} content={node.owner_id} />
        <GridLi
          title="Date registered"
          content={`${nanoTimestampToDate(
            node.registration_time
          ).toDateString()}`}
        />
        <GridLi
          title={"Last success"}
          content={`${
            node.last_success
              ? nanoTimestampToDate(node.last_success).toDateString()
              : "N/A"
          }`}
        />
        <GridLi
          title="Last Failure"
          content={`${
            node.last_failure
              ? nanoTimestampToDate(node.last_failure).toDateString()
              : "N/A"
          }`}
        />
        <GridLi
          title="Last Rejected"
          content={`${
            node.last_reject
              ? nanoTimestampToDate(node.last_reject).toDateString()
              : "N/A"
          }`}
        />
        <GridLi title="Total success" content={`${node.successful_runs}`} />
        <GridLi title="Total failure" content={`${node.failed_runs}`} />
        <GridLi title="Total rejected" content={`${node.rejected_runs}`} />
        <GridLi title="Total Unanswered" content={`${node.unanswered_runs}`} />
        <GridLi title="Allow Network" content={`${node.allow_network}`} />
        <GridLi title="Allow GPU" content={`${node.allow_gpu}`} />
        <GridLi title="Absolute Timeout" content={`${node.absolute_timeout}`} />
      </List>
    </Suspense>
  );
};
