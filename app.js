// app.js - Final version for Hybrid Prepaid Meter

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, onValue, set, get, update
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

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

// Meter selection
const params = new URLSearchParams(window.location.search);
const meter = params.get("meter") || "meter1";
const basePath = `/meters/${meter}/`;

// UI Elements
const gridBtn = document.getElementById("gridBtn");
const invBtn = document.getElementById("invBtn");
const loadOnBtn = document.getElementById("loadOnBtn");
const loadOffBtn = document.getElementById("loadOffBtn");
const rechargeBtn = document.getElementById("rechargeBtn");
const rechargeInput = document.getElementById("rechargeInput");
const resetBtn = document.getElementById("resetBtn");

const balanceSpan = document.getElementById("balance");
const totalCostSpan = document.getElementById("totalCost");
const modeBadge = document.getElementById("modeBadge");
const errorBanner = document.getElementById("errorBanner");

// readings
const impV = document.getElementById("impV");
const impI = document.getElementById("impI");
const impP = document.getElementById("impP");
const impK = document.getElementById("impK");
const expV = document.getElementById("expV");
const expI = document.getElementById("expI");
const expP = document.getElementById("expP");
const expK = document.getElementById("expK");

// badges
const loadPower = document.getElementById("loadPower");
const netEnergy = document.getElementById("netEnergy");
const directionDiv = document.getElementById("direction");
const overloadMsg = document.getElementById("overloadMsg");

// -----------------------------------------
onValue(ref(db, basePath), (snap) => {
  const d = snap.val() || {};

  const balance = parseFloat(d.balance ?? 0);
  const total_cost = parseFloat(d.total_cost ?? 0);
  const source_is_grid = d.source_is_grid ?? true;
  const load_status = d.load_status ?? false;

  const impPp = parseFloat(d.import_power ?? 0);
  const expPp = parseFloat(d.export_power ?? 0);

  const impKK = parseFloat(d.import_kWh ?? 0);
  const expKK = parseFloat(d.export_kWh ?? 0);

  const overload_msg = d.overload_msg ?? "";
  const error_msg = d.error_msg ?? "";

  // update UI
  balanceSpan.textContent = balance.toFixed(3);
  totalCostSpan.textContent = "Rs " + total_cost.toFixed(2);

  modeBadge.textContent = source_is_grid ? "Grid" : "Inverter";

  impV.textContent = (d.import_voltage ?? 0).toFixed(1);
  impI.textContent = (d.import_current ?? 0).toFixed(2);
  impP.textContent = Math.round(impPp);
  impK.textContent = impKK.toFixed(3);

  expV.textContent = (d.export_voltage ?? 0).toFixed(1);
  expI.textContent = (d.export_current ?? 0).toFixed(2);
  expP.textContent = Math.round(expPp);
  expK.textContent = expKK.toFixed(3);

  if(load_status){
    let P = source_is_grid ? impPp : expPp;
    loadPower.textContent = Math.round(P) + " W";
    directionDiv.textContent = source_is_grid ? "Importing from Grid" : "Exporting from Inverter";
  } else {
    loadPower.textContent = "0 W";
    directionDiv.textContent = "Idle";
  }

  netEnergy.textContent = (impKK - expKK).toFixed(3) + " kWh";

  overloadMsg.textContent = overload_msg;

  if(error_msg){
    errorBanner.hidden = false;
    errorBanner.textContent = error_msg;
  } else {
    errorBanner.hidden = true;
  }

  // grid + zero balance → disable Load ON
  if(source_is_grid && balance <= 0){
    loadOnBtn.disabled = true;
  } else {
    loadOnBtn.disabled = false;
  }
});

// -----------------------------------------
//           BUTTON HANDLERS
// -----------------------------------------

gridBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), true);
});

invBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), false);
});

loadOnBtn.addEventListener("click", async () => {
  const balSnap = await get(ref(db, basePath + "balance"));
  const bal = balSnap.exists() ? parseFloat(balSnap.val()) : 0;

  const mode = await get(ref(db, basePath + "source_is_grid"));

  if(mode.val() === true && bal <= 0){
    alert("Balance Zero → Grid Load Not Allowed");
    return;
  }

  await set(ref(db, basePath + "load_status"), true);
});

loadOffBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "load_status"), false);
});

// -----------------------------------------
//                RECHARGE
// -----------------------------------------
rechargeBtn.addEventListener("click", async () => {
  const units = parseFloat(rechargeInput.value);
  if(isNaN(units) || units <= 0){
    alert("Enter valid units");
    return;
  }

  const balSnap = await get(ref(db, basePath + "balance"));
  const currBal = balSnap.exists() ? parseFloat(balSnap.val()) : 0;

  const costSnap = await get(ref(db, basePath + "total_cost"));
  const currCost = costSnap.exists() ? parseFloat(costSnap.val()) : 0;

  const rechargeCost = units * 50;   // Rs 50 per kWh

  await update(ref(db, basePath), {
    balance: currBal + units,
    total_cost: currCost + rechargeCost,
    error_msg: ""
  });

  alert(`Recharge OK ✓\nAdded: ${units} kWh\nCost: Rs ${rechargeCost}`);

  rechargeInput.value = "";
});

// -----------------------------------------
//                RESET ALL
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
  };

  await set(ref(db, basePath), resetData);

  alert("Reset Complete ✓");
});
