import { ClientNode } from "../../../execution-client/types";
import { ClientMessage } from "../../../execution-client/database";
import { ReadyState } from "react-use-websocket";
import React from "react";


export const readyStateToString = (readyState: ReadyState): string => {
  switch (readyState) {
    case ReadyState.CONNECTING:
      return "Connecting";
    case ReadyState.OPEN:
      return "Open";
    case ReadyState.CLOSING:
      return "Closing";
    case ReadyState.CLOSED:
      return "Closed";
    case ReadyState.UNINSTANTIATED:
      return "Uninstantiated";
    default:
      console.log(`Unknown ready state ${readyState}`);
      return "";
  }
};

// export const messageFactory = async (n: number): Promise<Partial<ClientMessage>[]> => {
export const messageFactory = (n: number): Partial<ClientMessage>[] => {
  const res: Partial<ClientMessage>[] = [];

  const phases = [
    "Building image",
    "Running image",
    "Uploading results",
    "Cleaning up",
    "Publishing answer",
    "Complete",
    "etelpmoC",
  ];
  for (let i = 0; i < n; i++) {
    // for(let j = 0; j < phases.length; j++) {
    const phase = phases[Math.floor(Math.random() * phases.length)];
    // const phase = phases[j]
    const name = `bounty${i}`;
    res.push({
      eventType: "BountyUpdate",
      bountyId: name,
      //@ts-ignore-next-line
      context: {
        phase,
        imageName: name,
        containerName: name,
        failed: i % 2 === 0,
      },
      data: {
        phase,
        some_other_field: "some other value",
        data: "data",
      },
      sentAt: Date.now(),
    });
    // await sleep(500 + Math.ceil(Math.random() * 100 * 2))
    // }
  }
  return res;
};
