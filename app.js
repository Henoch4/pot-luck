import { ethers } from 'ethers';
import { AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';

const PROJECT_ID = 'f018499b1e4a94d961ab67aeeeff3254';

const botTestnet = {
  id: 968, name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { name: 'BOTScan Testnet', url: 'https://scan.bohr.life' } },
  testnet: true,
};
const botMainnet = {
  id: 677, name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
  blockExplorers: { default: { name: 'BOTScan', url: 'https://scan.botchain.ai' } },
};

const POT_ABI = [
  'function fund() view returns (address)',
  'function createCircle(uint256 contribution,uint256 rounds,address[] memberList)',
  'function contribute(uint256 circleId)',
  'function hasPaid(uint256 circleId,address member) view returns (bool)',
  'function getCircle(uint256 circleId) view returns (address,uint256,uint256,uint256,uint256,uint256,bool,address[])',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address,uint256) returns (bool)',
  'function deposit() payable',
  'function allowance(address,address) view returns (uint256)',
];

const CONTRACTS = {
  968: {
    pot: '0x5A5868e8CB560438f9A1b1eC0c16be5d9B0A8da1',
    twbot: '0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0',
  },
  677: {
    pot: '0x7F6fAFc9ed099a1Da4C36f7454DE7c2109aA9421',
    twbot: '0xD5452816194a3784dBa983426cCe7c122F4abd30',
  },
};

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 18) => Number(ethers.formatUnits(n, d)).toLocaleString(undefined, { maximumFractionDigits: 4 });

let appkit = null;
let readProvider;
let currentChainId = 677;
let account = null;
let circlesCache = [];

function initAppKit() {
  if (!$('connectBtn')) return;
  appkit = new AppKit({
    networks: [botTestnet, botMainnet],
    adapters: [new EthersAdapter()],
    projectId: PROJECT_ID,
    themeMode: 'dark',
    metadata: { name: 'Potluck', description: 'Rotating savings on BOT Chain', url: location.origin, icons: [] },
  });
  appkit.subscribeAccount((state) => {
    account = state.address || null;
    $('connectBtn').textContent = account ? account.slice(0, 6) + '…' + account.slice(-4) : 'Connect wallet';
    refresh();
  });
  $('connectBtn').addEventListener('click', () => appkit.open());
  $('netSel')?.addEventListener('change', (e) => { currentChainId = Number(e.target.value); refresh(); });
}

function readPot() {
  const c = CONTRACTS[currentChainId];
  if (!c) return null;
  return new ethers.Contract(c.pot, POT_ABI, readProvider);
}

function showMsg(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
}

async function listCircleIds() {
  const c = CONTRACTS[currentChainId];
  if (!c) return [];
  const topic = ethers.id('CircleCreated(uint256,address,uint256,uint256,uint256)');
  const logs = await readProvider.getLogs({ address: c.pot, topics: [topic], fromBlock: 0, toBlock: 'latest' });
  return logs.map((l) => Number(l.topics[1]));
}

async function refresh() {
  const pot = readPot();
  if (!pot) {
    ['tBal', 'tActive', 'tPaid', 'stCircles', 'stPaid'].forEach((id) => { const e = $(id); if (e) e.textContent = 'not on this chain'; });
    return;
  }
  try {
    const ids = await listCircleIds();
    const rows = await Promise.all(ids.map(async (id) => {
      const g = await pot.getCircle(id);
      return { id, creator: g[0], contribution: g[1], rounds: g[2], currentRound: g[3], paidCount: g[4], totalPaid: g[5], active: g[6], members: g[7] };
    }));
    circlesCache = rows;
    const active = rows.filter((r) => r.active);
    const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0n);
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('stCircles', String(rows.length));
    set('stPaid', String(rows.reduce((s, r) => s + BigInt(r.currentRound), 0n)));
    set('tActive', String(active.length));
    set('tPaid', fmt(totalPaid) + ' TW');
    if (account) {
      const c = CONTRACTS[currentChainId];
      const bal = await new ethers.Contract(c.twbot, ERC20_ABI, readProvider).balanceOf(account);
      set('tBal', fmt(bal) + ' TW');
    } else set('tBal', 'connect wallet');
    renderCircles(rows);
  } catch (e) {
    console.error(e);
    const list = $('circleList');
    if (list) list.innerHTML = '<div class="hint">Failed to load circles: ' + String(e.message || e).slice(0, 120) + '</div>';
  }
}

async function renderCircles(rows) {
  const list = $('circleList');
  if (!list) return;
  if (!rows.length) { list.innerHTML = '<div class="hint">No circles yet — create the first one.</div>'; return; }
  const pot = readPot();
  const paidStatus = await Promise.all(rows.map((r) => (account ? pot.hasPaid(r.id, account).catch(() => false) : false)));
  list.innerHTML = rows.map((r, i) => {
    const pct = r.rounds > 0n ? Number(r.currentRound * 10000n / r.rounds) / 100 : 0;
    const paidNow = paidStatus[i];
    return `<div class="circle-card">
      <div class="cc-top"><b>#${r.id} · ${fmt(r.contribution)} WBOT / round</b>
      <span class="tag ${r.active ? 'on' : 'off'}">${r.active ? 'active' : 'complete'}</span></div>
      <div class="cc-meta">
        <span>round <b>${r.currentRound + 1n}/${r.rounds}</b></span>
        <span>this round <b>${r.paidCount}/${r.members.length} paid</b></span>
        <span>pot <b>${fmt(r.contribution * BigInt(r.members.length))}</b></span>
        <span>you <b>${account ? (paidNow ? 'paid ✓' : 'pending') : '—'}</b></span>
        <span>creator <b class="mono" style="font-size:12px">${r.creator.slice(0, 6)}…${r.creator.slice(-4)}</b></span>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
}

async function signerOrAlert() {
  if (!account) { appkit?.open(); return null; }
  if (!CONTRACTS[currentChainId]) { alert('No contracts on this network in this app. Switch to BOT Chain 677 or Testnet 968.'); return null; }
  const s = await appkit?.getSigner();
  if (!s) { appkit?.open(); return null; }
  return s;
}

async function ensureAllowance(tokenAddr, spender, amount) {
  const s = await signerOrAlert();
  if (!s) return false;
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, s);
  const owner = await s.getAddress();
  const allow = await token.allowance(owner, spender);
  if (allow >= amount) return true;
  const tx = await token.approve(spender, amount);
  showMsg('cMsg', 'Approving WBOT…');
  await tx.wait();
  return true;
}

async function ensureWbot(amount, msgId) {
  const s = await signerOrAlert();
  if (!s) return false;
  const c = CONTRACTS[currentChainId];
  const w = new ethers.Contract(c.twbot, ERC20_ABI, s);
  const owner = await s.getAddress();
  const bal = await w.balanceOf(owner);
  if (bal >= amount) return true;
  const shortfall = amount - bal;
  const native = await s.provider.getBalance(owner);
  const gasCost = ethers.parseUnits('0.005', 18);
  if (native < shortfall + gasCost) {
    showMsg(msgId, 'Need ' + fmt(shortfall + gasCost - native) + ' more BOT — fund the wallet first (wrap + gas).');
    return false;
  }
  showMsg(msgId, 'Wrapping BOT → WBOT…');
  const tx = await w.deposit({ value: shortfall });
  await tx.wait();
  return true;
}

async function doCreate() {
  const msgId = 'cMsg';
  const s = await signerOrAlert();
  if (!s) return;
  const c = CONTRACTS[currentChainId];
  const amt = $('cAmt')?.value, rounds = $('cRounds')?.value, raw = $('cMembers')?.value;
  if (!amt || Number(amt) <= 0) return showMsg(msgId, 'Enter a contribution amount');
  if (!rounds || Number(rounds) < 1) return showMsg(msgId, 'Enter rounds (≥1)');
  const members = (raw || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  if (members.length < 2) return showMsg(msgId, 'Need ≥ 2 members');
  let addr;
  try { addr = members.map((m) => ethers.getAddress(m)); } catch { return showMsg(msgId, 'Invalid address in list'); }
  const me = await s.getAddress();
  if (!addr.includes(me)) return showMsg(msgId, 'Your own address must be in the member list');
  const pot = new ethers.Contract(c.pot, POT_ABI, s);
  showMsg(msgId, 'Sending createCircle…');
  try {
    const tx = await pot.createCircle(ethers.parseEther(amt), rounds, addr);
    showMsg(msgId, 'Sent: ' + tx.hash.slice(0, 14) + '…');
    await tx.wait();
    showMsg(msgId, 'Circle created ✓');
    refresh();
  } catch (e) { showMsg(msgId, 'Failed: ' + (e.shortMessage || e.message || '').slice(0, 140)); }
}

async function doContribute() {
  const msgId = 'pMsg';
  const s = await signerOrAlert();
  if (!s) return;
  const c = CONTRACTS[currentChainId];
  const idStr = $('cId')?.value;
  if (idStr === '' || Number(idStr) < 0) return showMsg(msgId, 'Enter a circle ID');
  const id = BigInt(idStr);
  const pot = new ethers.Contract(c.pot, POT_ABI, readProvider);
  let info;
  try { info = await pot.getCircle(id); } catch { return showMsg(msgId, 'No such circle'); }
  if (!info[6]) return showMsg(msgId, 'Circle is not active');
  if (!(await ensureWbot(info[1], msgId))) return;
  if (!(await ensureAllowance(c.twbot, c.pot, info[1]))) return;
  const potW = new ethers.Contract(c.pot, POT_ABI, s);
  showMsg(msgId, 'Sending contribute…');
  try {
    const tx = await potW.contribute(id);
    showMsg(msgId, 'Sent: ' + tx.hash.slice(0, 14) + '…');
    await tx.wait();
    showMsg(msgId, 'Contribution confirmed ✓ (round payout fires if you were last)');
    refresh();
  } catch (e) { showMsg(msgId, 'Failed: ' + (e.shortMessage || e.message || '').slice(0, 140)); }
}

function boot() {
  readProvider = new ethers.JsonRpcProvider(currentChainId === 677 ? 'https://rpc.botchain.ai' : 'https://rpc.bohr.life');
  initAppKit();
  $('cBtn')?.addEventListener('click', doCreate);
  $('pBtn')?.addEventListener('click', doContribute);
  refresh();
  setInterval(refresh, 25000);
}
boot();
