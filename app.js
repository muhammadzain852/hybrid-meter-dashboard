// app.js - Final version for Hybrid Prepaid Meter
// Firebase v12 modular SDK

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, onValue, set, get, update
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// -----------------------------------------
//  Firebase Config
// -----------------------------------------
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

// -----------------------------------------
//  METER SELECTION
// -----------------------------------------
const params = new URLSearchParams(window.location.search);
const meter = params.get("meter") || "meter1";
const basePath = `/meters/${meter}/`;

// -----------------------------------------
//  UI ELEMENTS
// -----------------------------------------
const gridBtn = document.getElementById("gridBtn");
const invBtn = document.getElementById("invBtn");

const loadOnBtn = document.getElementById("loadOnBtn");
const loadOffBtn = document.getElementById("loadOffBtn");

const resetBtn = document.getElementById("resetBtn");

const rechargeBtn = document.getElementById("rechargeBtn");
const rechargeInput = document.getElementById("rechargeInput");

const balanceSpan = document.getElementById("balance");
const totalCostSpan = document.getElementById("totalCost");
const modeBadge = document.getElementById("modeBadge");

const errorBanner = document.getElementById("errorBanner");
const overloadMsg = document.getElementById("overloadMsg");
const meterIdLabel = document.getElementById("meterIdLabel");

// Readings
const impV   = document.getElementById("impV");
const impI   = document.getElementById("impI");
const impP   = document.getElementById("impP");
const impK   = document.getElementById("impK");

const expV   = document.getElementById("expV");
const expI   = document.getElementById("expI");
const expP   = document.getElementById("expP");
const expK   = document.getElementById("expK");

const loadPower = document.getElementById("loadPower");
const netEnergy = document.getElementById("netEnergy");
const directionDiv = document.getElementById("direction");

// -----------------------------------------
meterIdLabel.textContent = `Meter: ${meter}`;

// -----------------------------------------
//  REALTIME DATABASE LISTENER
// -----------------------------------------
onValue(ref(db, basePath), (snap) => {
  const d = snap.val() || {};

  const source_is_grid = d.source_is_grid ?? true;
  const load_status    = d.load_status ?? false;
  const balance        = parseFloat(d.balance ?? 0);
  const total_cost     = parseFloat(d.total_cost ?? 0);

  const impVv = parseFloat(d.import_voltage ?? 0);
  const impIi = parseFloat(d.import_current ?? 0);
  const impPp = parseFloat(d.import_power ?? 0);
  const impKK = parseFloat(d.import_kWh ?? 0);

  const expVv = parseFloat(d.export_voltage ?? 0);
  const expIi = parseFloat(d.export_current ?? 0);
  const expPp = parseFloat(d.export_power ?? 0);
  const expKK = parseFloat(d.export_kWh ?? 0);

  const overload_msg = d.overload_msg ?? "";
  const error_msg = d.error_msg ?? "";

  // Update UI
  modeBadge.textContent = source_is_grid ? "Grid" : "Inverter";
  balanceSpan.textContent = balance.toFixed(3);
  totalCostSpan.textContent = "Rs " + total_cost.toFixed(2);

  impV.textContent = impVv.toFixed(1);
  impI.textContent = impIi.toFixed(2);
  impP.textContent = Math.round(impPp);
  impK.textContent = impKK.toFixed(3);

  expV.textContent = expVv.toFixed(1);
  expI.textContent = expIi.toFixed(2);
  expP.textContent = Math.round(expPp);
  expK.textContent = expKK.toFixed(3);

  // Load power
  if(load_status){
    loadPower.textContent = Math.round(source_is_grid ? impPp : expPp) + " W";
    directionDiv.textContent = source_is_grid ? "Importing from Grid" : "Exporting from Inverter";
  } else {
    loadPower.textContent = "0 W";
    directionDiv.textContent = "Idle";
  }

  // Net energy
  const net = (impKK - expKK);
  netEnergy.textContent = net.toFixed(3) + " kWh";

  // Overload
  overloadMsg.textContent = overload_msg;

  // Error banner
  if(error_msg && error_msg.length > 1){
    errorBanner.hidden = false;
    errorBanner.textContent = error_msg;

    // show popup once
    if(!window._shownErr || window._shownErr !== error_msg){
      alert(error_msg);
      window._shownErr = error_msg;
    }
  } else {
    errorBanner.hidden = true;
    errorBanner.textContent = "";
    window._shownErr = "";
  }

  // Disable Load ON button if GRID & balance 0
  if(source_is_grid && balance <= 0){
    loadOnBtn.disabled = true;
    loadOnBtn.classList.add("disabled");
  } else {
    loadOnBtn.disabled = false;
    loadOnBtn.classList.remove("disabled");
  }
});

// -----------------------------------------
//  BUTTON HANDLERS
// -----------------------------------------

// Enable Grid mode
gridBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), true);
});

// Enable Inverter mode
invBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), false);
});

// Load ON
loadOnBtn.addEventListener("click", async () => {
  const balSnap = await get(ref(db, basePath + "balance"));
  const bal = balSnap.exists() ? parseFloat(balSnap.val()) : 0;

  const modeSnap = await get(ref(db, basePath + "source_is_grid"));
  const gridMode = modeSnap.exists() ? !!modeSnap.val() : true;

  if(gridMode && bal <= 0){
    alert("Balance zero → Grid load not allowed");
    return;
  }

  await set(ref(db, basePath + "load_status"), true);
});

// Load OFF
loadOffBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "load_status"), false);
});

// -----------------------------------------
//   RECHARGE → balance + cost update
// -----------------------------------------
rechargeBtn.addEventListener("click", async () => {
  const add = parseFloat(rechargeInput.value);
  if(isNaN(add) || add <= 0){
    alert("Enter valid units (kWh)");
    return;
  }

  const balSnap = await get(ref(db, basePath + "balance"));
  const currBal = balSnap.exists() ? parseFloat(balSnap.val()) : 0;

  const costSnap = await get(ref(db, basePath + "total_cost"));
  const currCost = costSnap.exists() ? parseFloat(costSnap.val()) : 0;

  // Recharge cost = units × 50 Rs
  const rechargeCost = add * 50;

  await update(ref(db, basePath), {
    balance: currBal + add,
    total_cost: currCost + rechargeCost,
    error_msg: ""
  });

  alert(
    "Recharge Successful ✔\n" +
    "Units Added: " + add + " kWh\n" +
    "Cost Added: Rs " + rechargeCost
  );

  rechargeInput.value = "";
});

// -----------------------------------------
//   RESET EVERYTHING
// -----------------------------------------
resetBtn.addEventListener("click", async () => {
  if(!confirm("Reset EVERYTHING?")) return;

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

  alert("All values reset ✔");
});
