import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

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

const meterPath = "/meters/meter1/";

// ------------------ BUTTON HANDLERS -------------------

document.getElementById("gridBtn").onclick = () =>
  set(ref(db, meterPath + "source_is_grid"), true);

document.getElementById("invBtn").onclick = () =>
  set(ref(db, meterPath + "source_is_grid"), false);

document.getElementById("loadOnBtn").onclick = () =>
  set(ref(db, meterPath + "load_status"), true);

document.getElementById("loadOffBtn").onclick = () =>
  set(ref(db, meterPath + "load_status"), false);

document.getElementById("rechargeBtn").onclick = async () => {
  let add = parseFloat(document.getElementById("rechargeInput").value);
  if(isNaN(add) || add <= 0){ alert("Enter valid kWh"); return; }

  let snap = await get(ref(db, meterPath + "balance"));
  let curr = snap.exists() ? snap.val() : 0;
  let newBal = curr + add;

  await set(ref(db, meterPath + "recharge_value"), add);
  await set(ref(db, meterPath + "balance"), newBal);
  alert("Recharged!");
};

document.getElementById("resetBtn").onclick = () =>
  set(ref(db, meterPath), {
    source_is_grid:true,
    load_status:false,
    balance:0,
    import_voltage:0,
    import_current:0,
    import_power:0,
    import_kWh:0,
    export_voltage:0,
    export_current:0,
    export_power:0,
    export_kWh:0,
    overload_msg:""
  });

// ------------------ REALTIME LISTENER -------------------

onValue(ref(db, meterPath), snap => {
  let d = snap.val() || {};

  document.getElementById("modeBadge").textContent =
      d.source_is_grid ? "Grid" : "Inverter";

  document.getElementById("balance").textContent =
      (d.balance || 0).toFixed(3) + " kWh";

  document.getElementById("impV").textContent = d.import_voltage || 0;
  document.getElementById("impI").textContent = d.import_current || 0;
  document.getElementById("impP").textContent = d.import_power || 0;
  document.getElementById("impK").textContent = d.import_kWh || 0;

  document.getElementById("expV").textContent = d.export_voltage || 0;
  document.getElementById("expI").textContent = d.export_current || 0;
  document.getElementById("expP").textContent = d.export_power || 0;
  document.getElementById("expK").textContent = d.export_kWh || 0;

  let net = (d.import_kWh || 0) - (d.export_kWh || 0);
  document.getElementById("netEnergy").textContent = net.toFixed(3) + " kWh";

  let loadPower = d.load_status
      ? (d.source_is_grid ? (d.import_power||0) : (d.export_power||0))
      : 0;

  document.getElementById("loadPower").textContent = loadPower + " W";

  if(d.load_status){
    document.getElementById("direction").textContent =
      d.source_is_grid ? "Importing from Grid" : "Exporting from Inverter";
  } else {
    document.getElementById("direction").textContent = "Idle";
  }

  document.getElementById("overloadMsg").textContent = d.overload_msg || "";
});

// END
