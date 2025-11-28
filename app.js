// app.js - final dashboard logic (module)
// requires index.html, style.css in same folder
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, onValue, set, get, update
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// ---- CONFIG ----
const firebaseConfig = {
  apiKey: "AIzaSyDTczn4au45tZ0sTU_D_MfSMz8C-qdbH30",
  authDomain: "hybrid-prepaid-meter.firebaseapp.com",
  databaseURL: "https://hybrid-prepaid-meter-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hybrid-prepaid-meter",
  storageBucket: "hybrid-prepaid-meter.firebasestorage.app",
  messagingSenderId: "938034879077",
  appId: "1:938034879077:web:0c394171a9cdfd4d44c48c"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ---- Meter selection ----
const params = new URLSearchParams(window.location.search);
const meter = params.get("meter") || "meter1";
const basePath = `/meters/${meter}/`;

// ---- UI refs ----
const gridBtn = document.getElementById("gridBtn");
const invBtn  = document.getElementById("invBtn");
const loadOnBtn = document.getElementById("loadOnBtn");
const loadOffBtn = document.getElementById("loadOffBtn");
const resetBtn = document.getElementById("resetBtn");
const rechargeBtn = document.getElementById("rechargeBtn");
const rechargeInput = document.getElementById("rechargeInput");

const modeBadge = document.getElementById("modeBadge");
const balanceSpan = document.getElementById("balance");
const totalCostSpan = document.getElementById("totalCost");
const meterIdLabel = document.getElementById("meterIdLabel");
const errorBanner = document.getElementById("errorBanner");

const impV = document.getElementById("impV");
const impI = document.getElementById("impI");
const impP = document.getElementById("impP");
const impK = document.getElementById("impK");

const expV = document.getElementById("expV");
const expI = document.getElementById("expI");
const expP = document.getElementById("expP");
const expK = document.getElementById("expK");

const loadPower = document.getElementById("loadPower");
const netEnergy = document.getElementById("netEnergy");
const directionDiv = document.getElementById("direction");
const overloadMsg = document.getElementById("overloadMsg");

// rates (display-only)
const GRID_RATE = 50.0;
const INV_RATE = 20.0;

// set meter label
meterIdLabel.textContent = `Meter: ${meter}`;

// ---- realtime listener for whole meter ----
onValue(ref(db, basePath), (snap) => {
  const d = snap.val() || {};

  // State
  const source_is_grid = d.source_is_grid ?? true;
  const load_status = d.load_status ?? false;
  const balance = parseFloat(d.balance ?? 0);
  const totalCost = parseFloat(d.total_cost ?? 0);

  // telemetry
  const import_voltage = parseFloat(d.import_voltage ?? 0);
  const import_current = parseFloat(d.import_current ?? 0);
  const import_power = parseFloat(d.import_power ?? 0);
  const import_kWh = parseFloat(d.import_kWh ?? 0);

  const export_voltage = parseFloat(d.export_voltage ?? 0);
  const export_current = parseFloat(d.export_current ?? 0);
  const export_power = parseFloat(d.export_power ?? 0);
  const export_kWh = parseFloat(d.export_kWh ?? 0);

  const overload_msg = d.overload_msg ?? "";
  const error_msg = d.error_msg ?? "";

  // UI updates
  modeBadge.textContent = source_is_grid ? "Grid" : "Inverter";
  balanceSpan.textContent = balance.toFixed(3);
  totalCostSpan.textContent = `Rs ${totalCost.toFixed(2)}`;

  impV.textContent = import_voltage.toFixed(1);
  impI.textContent = import_current.toFixed(2);
  impP.textContent = Math.round(import_power);
  impK.textContent = import_kWh.toFixed(3);

  expV.textContent = export_voltage.toFixed(1);
  expI.textContent = export_current.toFixed(2);
  expP.textContent = Math.round(export_power);
  expK.textContent = export_kWh.toFixed(3);

  // load power & direction
  let lp = 0;
  if(load_status){
    lp = source_is_grid ? import_power : export_power;
    directionDiv.textContent = source_is_grid ? "Importing from Grid" : "Exporting from Inverter";
  } else {
    directionDiv.textContent = "Idle";
  }
  loadPower.textContent = Math.round(lp) + " W";

  // net energy
  const net = (import_kWh || 0) - (export_kWh || 0);
  netEnergy.textContent = net.toFixed(3) + " kWh";

  // overload
  overloadMsg.textContent = overload_msg || "";

  // error handling & blocking UI
  if(error_msg && error_msg.length > 1){
    // show banner and popup
    errorBanner.hidden = false;
    errorBanner.textContent = error_msg;
    // small non-blocking popup (once)
    if(!window._shownErr || window._shownErr !== error_msg){
      alert(error_msg);
      window._shownErr = error_msg;
    }
  } else {
    errorBanner.hidden = true;
    errorBanner.textContent = "";
    window._shownErr = "";
  }

  // Disable load ON button if Grid selected and balance <= 0
  if(source_is_grid && balance <= 0){
    loadOnBtn.disabled = true;
    loadOnBtn.title = "Balance zero — recharge to enable Grid load";
    loadOnBtn.classList.add("disabled");
  } else {
    loadOnBtn.disabled = false;
    loadOnBtn.title = "";
    loadOnBtn.classList.remove("disabled");
  }
});

// ---- Button handlers ----
gridBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), true);
});

invBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), false);
});

loadOnBtn.addEventListener("click", async () => {
  // client-side safety: check balance & mode before sending request
  const snap = await get(ref(db, basePath + "balance"));
  const bal = snap.exists() ? parseFloat(snap.val()) : 0;
  const modeSnap = await get(ref(db, basePath + "source_is_grid"));
  const srcGrid = modeSnap.exists() ? !!modeSnap.val() : true;

  if(srcGrid && bal <= 0){
    alert("Balance is zero. Recharge first to enable Grid load.");
    return;
  }

  // set load_status true — ESP32 will actually switch relays
  await set(ref(db, basePath + "load_status"), true);
});

loadOffBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "load_status"), false);
});

rechargeBtn.addEventListener("click", async () => {
  const add = parseFloat(rechargeInput.value);
  if(isNaN(add) || add <= 0){ alert("Enter valid kWh to add"); return; }

  // atomic-ish update: read balance then update
  const snap = await get(ref(db, basePath + "balance"));
  const curr = snap.exists() ? parseFloat(snap.val()) : 0;
  const newBal = curr + add;

  await set(ref(db, basePath + "recharge_value"), add);
  await set(ref(db, basePath + "balance"), newBal);

  // clear error msg if recharged
  await set(ref(db, basePath + "error_msg"), "");
  alert(`Recharged ${add} kWh`);
  rechargeInput.value = "";
});

resetBtn.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to reset EVERYTHING?")) return;

  // Full reset values
  const resetData = {
    source_is_grid: true,
    load_status: false,
    balance: 0,
    total_cost: 0,

    import_voltage: 0,
    import_current: 0,
    import_power: 0,
    import_kWh: 0,

    export_voltage: 0,
    export_current: 0,
    export_power: 0,
    export_kWh: 0,

    error_msg: "",
    overload_msg: "",
    recharge_value: 0
  };

  await set(ref(db, basePath), resetData);

  alert("Reset Complete ✔\nAll data cleared.");
});

