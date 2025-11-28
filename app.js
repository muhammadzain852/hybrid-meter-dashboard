/* FINAL CLEAN APP.JS */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const meterRef = ref(db, "meters/meter1");

// ---------------- BUTTONS ----------------
document.getElementById("gridBtn").onclick = () =>
    update(meterRef, { source_is_grid: true });

document.getElementById("invBtn").onclick = () =>
    update(meterRef, { source_is_grid: false });

document.getElementById("loadOnBtn").onclick = () =>
    update(meterRef, { load_status: true });

document.getElementById("loadOffBtn").onclick = () =>
    update(meterRef, { load_status: false });

// ---------------- RECHARGE ----------------
document.getElementById("rechargeBtn").onclick = async () => {
    const val = parseFloat(document.getElementById("rechargeInput").value);
    if (isNaN(val) || val <= 0) return;

    const snap = await get(meterRef);
    const data = snap.val();

    let cost = (data.source_is_grid) ? val * 50 : val * 20;
    let newBalance = data.balance + val;
    let newCost = data.total_cost + cost;

    update(meterRef, {
        balance: newBalance,
        total_cost: newCost
    });

    document.getElementById("rechargeInput").value = "";
};

// ---------------- RESET ALL ----------------
document.getElementById("resetBtn").onclick = () => {
    update(meterRef, {
        reset_flag: true,
        balance: 0,
        load_status: false,
        source_is_grid: true,
        import_kWh: 0,
        export_kWh: 0,
        total_cost: 0
    });
};

// ---------------- LIVE UPDATES ----------------
onValue(meterRef, (snapshot) => {
    const d = snapshot.val();

    document.getElementById("mode").innerText = d.source_is_grid ? "Grid" : "Inverter";
    document.getElementById("balance").innerText = d.balance.toFixed(3);
    document.getElementById("totalCost").innerText = d.total_cost.toFixed(2);

    document.getElementById("impV").innerText = d.import_voltage.toFixed(1);
    document.getElementById("impC").innerText = d.import_current.toFixed(2);
    document.getElementById("impP").innerText = d.import_power.toFixed(0);
    document.getElementById("impK").innerText = d.import_kWh.toFixed(3);

    document.getElementById("expV").innerText = d.export_voltage.toFixed(1);
    document.getElementById("expC").innerText = d.export_current.toFixed(2);
    document.getElementById("expP").innerText = d.export_power.toFixed(0);
    document.getElementById("expK").innerText = d.export_kWh.toFixed(3);
});
