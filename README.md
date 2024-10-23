
# CRTIMK

**CRTIMK** (Computational Resource and Task Infrastructure for the Masses) is a decentralized, serverless platform that enables users to rent out their home devices, including specialized ones like mining rigs, to perform computational tasks for Web3 applications. Inspired by the accessibility and decentralization ethos of Ethereum’s Proof of Work, CRTIMK provides a highly flexible and easy-to-use system that supports arbitrary code execution on a network of distributed nodes.

## Inspiration

CRTIMK draws inspiration from the success of decentralized mining and participation frameworks, particularly ETH PoW. While PoW had its flaws, it allowed wide accessibility and decentralization, which CRTIMK seeks to replicate and improve upon. We are motivated by the cypherpunk spirit of early crypto pioneers, aiming to build a system that removes power from centralized tech monopolies. Currently, many Web3 products are either centralized or hosted on centralized infrastructure. CRTIMK aims to make a sharp turn in the opposite direction, offering a platform that’s both decentralized and accessible to everyone.

## What it Does

- Provides a simple yet powerful off-chain backend solution for Web3 applications.
- Enables the execution of arbitrary code across a decentralized network of nodes, offering unparalleled flexibility.
- Allows anyone, from mining rig owners to casual users, to participate in the network by running a lightweight client on their devices.
- Supports a wide variety of compute devices, from high-performance GPUs to low-power devices like Raspberry Pi.
- Offers a new purpose for miners displaced by the Ethereum merge by allowing GPU compute tasks.
- Offers low-power devices a meaningful role in the network, ensuring inclusivity in compute operations.

## How We Built It

- **Persistence:** All system states are maintained on NEAR, with the contract handling task assignments for off-chain nodes.
- **Client:** A lightweight, easy-to-install client that runs on most computers, designed to be as accessible and low-maintenance as possible.
- **Frontend:** A responsive and intuitive Web3 interface that behaves like a Web2 app, providing seamless user interaction.
- **Ease of Use:** Our client features a one-line installer for both installation and updates, and requires no complex infrastructure (databases, reverse proxies, etc.).

## Key Features

- **No Slashing Risk:** Unlike many off-chain networks, CRTIMK offers lower risks for node operators by eliminating slashing. Gas is only consumed for essential functions, and rewards are guaranteed in those cases.
- **Developer Flexibility:** Supports the execution of any type of code via Dockerfiles, allowing developers to schedule tasks and create bounties.
- **Compatibility:** CRTIMK supports multiple chains by decoupling the client from the NEAR contract, making it future-proof and adaptable.

## Challenges We Faced

- **Complex Pitch:** Condensing CRTIMK’s deep stack functionality into a concise pitch for investors was challenging.
- **Technical Roadblocks:** We faced challenges like getting the indexer to run on non-enterprise hardware and adapting tools for M1 Macs, which led us to use Rust to write the contract.
  
## Accomplishments

- Built a highly flexible off-chain client that can run virtually anything on demand.
- Created a user-friendly experience, ensuring non-technical users can easily participate.
- Achieved successful deployment on low-power devices like the Gen1 Pi Zero, showing the system’s range and accessibility.
- Leveraged NEAR’s performance to create a real-time, responsive frontend that feels like a Web2 application.

## What We Learned

- Rust programming and smart contract development.
- The challenges of delivering technical presentations to diverse audiences.
- The importance of time management, particularly in a fast-paced development cycle.

## What's Next for CRTIMK

- Improving node security through sandboxing and regular security audits.
- Enhancing our bounty system with better retry mechanisms for failed tasks.
- Expanding multi-chain compatibility by separating the client from its contract component.
- Continued refinement of our pitching strategy to better communicate the value to technical audiences.

## Built With

- **Ansible**
- **Bash**
- **Docker**
- **Linux**
- **NEAR**
- **React**
- **Rust**
- **Typescript**


Decentralized serverless for the masses, built on NEAR


## Getting Started

### Node Operators/Non-Technical
Please refer to the [execution client](../execution-client/README.md) for instructions on how to run a node using our one-line installer.

### Consumers/Technical
Please refer to the [contract readme](./contract/README.md) for details about CRTIMK, including guidelines for setting up packages for execution on the network.

### Developers
Please refer to the following directories/readmes for more information:
- [contract](../contract/README.md): The backend for CRTIMK, built on NEAR.
- [execution client](../execution-client/README.md): The component that runs off-chain workloads.
- [playbook](../playbook/README.md): The one-line installer for the execution client.
- [frontend](../frontend): The frontend for CRTIMK.

---

## Inspiration
CRTIMK is inspired by the decentralized nature of Ethereum’s Proof of Work and the cypherpunk ideals of early crypto pioneers. It seeks to remove power from centralized tech monopolies and make Web3 truly decentralized and accessible to everyone.

## What it Does
CRTIMK allows users to rent out their home devices, including mining rigs, to perform computational tasks for Web3 applications. It provides a universal off-chain backend for Web3 with flexibility for arbitrary code execution across a decentralized network of nodes.

## How We Built It
We built CRTIMK using NEAR for state persistence, a lightweight off-chain client for decentralized node execution, and a user-friendly frontend that feels like a Web2 app. The system is designed for accessibility with a one-line installer and easy-to-use components.

## Challenges We Ran Into
We faced challenges in pitching our deep stack solution to investors and encountered technical roadblocks like running the indexer on non-enterprise hardware and adapting tools for M1 Macs.

## Accomplishments That We're Proud Of
We’re proud of our flexible off-chain client that can run virtually any task, our low-power device support, and our intuitive, Web2-like frontend built on NEAR’s powerful infrastructure.

## What We Learned
We learned Rust and smart contract programming, and realized the difficulty of condensing technical ideas into short presentations. We also learned how to manage time effectively in fast-paced development cycles.

## What's Next for CRTIMK
We plan to enhance node security with sandboxing and security audits, refine our bounty retry mechanism, expand multi-chain compatibility, and improve our technical pitches.