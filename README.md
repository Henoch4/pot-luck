# Potluck — rotating savings circles on BOT Chain

A fully on-chain rotating savings circle (ajo / susu / esusu) on **BOT Chain testnet (chain 968)**.
A group locks a fixed TestWBOT contribution per round; every round the whole pot pays out to
one member until everyone has received their turn.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Landing — live circle stats and how the pot works |
| `app.html` | Create circles, join, contribute, watch payouts |
| `docs.html` | Round mechanics, contract API, demo activity, build & verify |

## On-chain (testnet)

- **Potluck:** [`0x5A5868e8CB560438f9A1b1eC0c16be5d9B0A8da1`](https://scan.bohr.life/address/0x5A5868e8CB560438f9A1b1eC0c16be5d9B0A8da1) — verified ✓
- **TestWBOT (contribution token):** [`0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0`](https://scan.bohr.life/address/0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0) — `faucet()` mints 1,000 per tx
- Chain: `968` · RPC `https://rpc.bohr.life` · explorer `https://scan.bohr.life`

## Core API

```
createCircle(contribution, rounds, memberList)  — creator must be in the list (no payment yet)
contribute(circleId)                            — pay this round's share (TestWBOT)
hasPaid(circleId, member)                       — per-round payment check
getCircle(circleId)                             — full circle state
```

Events: `CircleCreated`, `Contributed`, `Payout`.

## Run locally

Static site — any file server works:

```bash
npx serve .
```

## Stack

- Vanilla HTML/CSS/JS (no build step)
- [ethers.js 6](https://docs.ethers.org/) via esm.sh
- [Reown AppKit](https://reown.com/appkit) for wallet connect
- Testnet tokens only — no monetary value
