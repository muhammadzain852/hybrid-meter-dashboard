// app.js - Modern light dashboard (modular Firebase v12+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getDatabase, ref, onValue, set, get, update
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// ---------------- FIREBASE CONFIG ----------------
// Use your Firebase config (these are from your project memory earlier)
// Replace here if needed
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
const auth = getAuth(app);
const db = getDatabase(app);

// ---------------- UI refs ----------------
const authScreen = document.getElementById("auth-screen");
const appRoot = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

const r_email = document.getElementById("r_email");
const r_password = document.getElementById("r_password");
const registerBtn = document.getElementById("registerBtn");

const reset_email = document.getElementById("reset_email");
const resetBtnSend = document.getElementById("resetBtnSend");
const authError = document.getElementById("authError");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");
const showLogin2 = document.getElementById("showLogin2");
const showReset = document.getElementById("showReset");

// panels
const panels = { dashboard: document.getElementById("panel-dashboard"),
                 control: document.getElementById("panel-control"),
                 settings: document.getElementById("panel-settings") };

const menuButtons = document.querySelectorAll(".menu-item");
const signOutBtn = document.getElementById("signOutBtn");

// user UI spans
const userEmailSpan = document.getElementById("userEmail");
const meterLabel = document.getElementById("meterLabel");

// meter controls and fields
const meter = "meter1"; // for demo. You can make dynamic later.
const basePath = `/meters/${meter}/`;

// dashboard elements
const modeBadge = document.getElementById("modeBadge");
const balanceSpan = document.getElementById("balance");
const totalCostSpan = document.getElementById("totalCost");
const loadPower = document.getElementById("loadPower");
const netEnergy = document.getElementById("netEnergy");
const directionDiv = document.getElementById("direction");
const impV = document.getElementById("impV");
const impI = document.getElementById("impI");
const impP = document.getElementById("impP");
const impK = document.getElementById("impK");
const expV = document.getElementById("expV");
const expI = document.getElementById("expI");
const expP = document.getElementById("expP");
const expK = document.getElementById("expK");
const errorBanner = document.getElementById("errorBanner");
const overloadMsg = document.getElementById("overloadMsg");

const gridBtn = document.getElementById("gridBtn");
const invBtn = document.getElementById("invBtn");
const loadOnBtn = document.getElementById("loadOnBtn");
const loadOffBtn = document.getElementById("loadOffBtn");
const resetBtn = document.getElementById("resetBtn");
const rechargeBtn = document.getElementById("rechargeBtn");
const rechargeInput = document.getElementById("rechargeInput");

const ovThreshold = document.getElementById("ovThreshold");
const ocThreshold = document.getElementById("ocThreshold");
const minBalance = document.getElementById("minBalance");
const saveSettings = document.getElementById("saveSettings");

// menu nav
menuButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    menuButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const panel = btn.getAttribute("data-panel");
    Object.values(panels).forEach(p => p.classList.add("hidden"));
    panels[panel].classList.remove("hidden");
  });
});

// show register / login toggles
showRegister.addEventListener("click",(e)=>{e.preventDefault(); loginForm.classList.add("hidden"); registerForm.classList.remove("hidden"); authError.textContent="";});
showLogin.addEventListener("click",(e)=>{e.preventDefault(); registerForm.classList.add("hidden"); loginForm.classList.remove("hidden"); authError.textContent="";});
showLogin2.addEventListener("click",(e)=>{e.preventDefault(); resetForm.classList.add("hidden"); loginForm.classList.remove("hidden"); authError.textContent="";});
showReset.addEventListener("click",(e)=>{e.preventDefault(); loginForm.classList.add("hidden"); resetForm.classList.remove("hidden"); authError.textContent="";});

// ---------------- AUTH ----------------
loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  authError.textContent = "";
  try{
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch(err){
    authError.textContent = err.message;
  }
});

registerForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  authError.textContent = "";
  try{
    await createUserWithEmailAndPassword(auth, r_email.value, r_password.value);
    // create minimal user data in DB
    await set(ref(db, basePath), {
      master_on: true,
      source_is_grid: true,
      load_status: false,
      recharge_value: 0,
      balance: 0,
      import_voltage: 0,
      import_current: 0,
      import_power: 0,
      import_kWh: 0,
      export_voltage: 0,
      export_current: 0,
      export_power: 0,
      export_kWh: 0,
      total_cost: 0,
      reset_flag: false
    });
  } catch(err){ authError.textContent = err.message; }
});

resetForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try{
    await sendPasswordResetEmail(auth, reset_email.value);
    authError.textContent = "Reset email sent (check inbox).";
  } catch(err){ authError.textContent = err.message; }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// auth state
onAuthStateChanged(auth, (user) => {
  if(user){
    // logged in
    authScreen.classList.add("hidden");
    appRoot.classList.remove("hidden");
    userEmailSpan.textContent = user.email;
    meterLabel.textContent = `Meter: ${meter}`;
    startRealtimeListener();
  } else {
    // logged out
    appRoot.classList.add("hidden");
    authScreen.classList.remove("hidden");
    // show login form
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    resetForm.classList.add("hidden");
  }
});

// ---------------- Realtime listener ----------------
let dbListener = null;
function startRealtimeListener(){
  const meterRef = ref(db, basePath);
  if(dbListener) dbListener();
  dbListener = onValue(meterRef, (snap) => {
    const d = snap.val() || {};
    const source_is_grid = d.source_is_grid ?? true;
    const load_status = d.load_status ?? false;
    const balance = parseFloat(d.balance ?? 0);
    const total_cost = parseFloat(d.total_cost ?? 0);

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

    // update UI
    modeBadge.textContent = source_is_grid ? "Grid" : "Inverter";
    document.getElementById("modeSmall").textContent = source_is_grid ? "Grid" : "Inverter";
    balanceSpan.textContent = balance.toFixed(3) + " kWh";
    document.getElementById("balSmall").textContent = balance.toFixed(3) + " kWh";
    totalCostSpan.textContent = "Rs " + (total_cost || 0).toFixed(2);
    document.getElementById("costSmall").textContent = "Rs " + (total_cost || 0).toFixed(2);

    impV.textContent = impVv ? impVv.toFixed(1) : "0";
    impI.textContent = impIi ? impIi.toFixed(2) : "0.00";
    impP.textContent = Math.round(impPp || 0);
    impK.textContent = impKK ? impKK.toFixed(3) : "0.000";

    expV.textContent = expVv ? expVv.toFixed(1) : "0";
    expI.textContent = expIi ? expIi.toFixed(2) : "0.00";
    expP.textContent = Math.round(expPp || 0);
    expK.textContent = expKK ? expKK.toFixed(3) : "0.000";

    if(load_status){
      loadPower.textContent = Math.round(source_is_grid ? impPp : expPp) + " W";
      directionDiv.textContent = source_is_grid ? "Importing from Grid" : "Exporting from Inverter";
    } else {
      loadPower.textContent = "0 W";
      directionDiv.textContent = "Idle";
    }

    netEnergy.textContent = ((impKK || 0) - (expKK || 0)).toFixed(3) + " kWh";
    overloadMsg.textContent = overload_msg;

    if(error_msg){
      errorBanner.classList.remove("hidden");
      errorBanner.textContent = error_msg;
    } else {
      errorBanner.classList.add("hidden");
      errorBanner.textContent = "";
    }

    // disable load on when grid and balance zero
    if(source_is_grid && balance <= 0) loadOnBtn.disabled = true;
    else loadOnBtn.disabled = false;
  });
}

// ---------------- Controls ----------------
gridBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), true);
});
invBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "source_is_grid"), false);
});
loadOnBtn.addEventListener("click", async () => {
  const snap = await get(ref(db, basePath + "balance"));
  const bal = snap.exists() ? parseFloat(snap.val()) : 0;
  const modeSnap = await get(ref(db, basePath + "source_is_grid"));
  const gridMode = modeSnap.exists() ? !!modeSnap.val() : true;
  if(gridMode && bal <= 0){ alert("Balance zero. Recharge first."); return; }
  await set(ref(db, basePath + "load_status"), true);
});
loadOffBtn.addEventListener("click", async () => {
  await set(ref(db, basePath + "load_status"), false);
});

// recharge (units * 50 Rs)
rechargeBtn.addEventListener("click", async () => {
  const add = parseFloat(rechargeInput.value);
  if(isNaN(add) || add <= 0){ alert("Enter valid units"); return; }
  const balSnap = await get(ref(db, basePath + "balance"));
  const currBal = balSnap.exists() ? parseFloat(balSnap.val()) : 0;
  const costSnap = await get(ref(db, basePath + "total_cost"));
  const currCost = costSnap.exists() ? parseFloat(costSnap.val()) : 0;
  const rechargeCost = add * 50; // Rs 50 per kWh
  await update(ref(db, basePath), {
    balance: currBal + add,
    total_cost: currCost + rechargeCost,
    error_msg: ""
  });
  alert(`Recharge Successful\nUnits: ${add} kWh\nCost: Rs ${rechargeCost}`);
  rechargeInput.value = "";
});

// reset all
resetBtn.addEventListener("click", async () => {
  if(!confirm("Reset EVERYTHING? This will reset balance, kWh and total cost.")) return;
  await update(ref(db, basePath), {
    reset_flag: true,
    balance: 0,
    load_status: false,
    source_is_grid: true,
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
    total_cost: 0
  });
  alert("Reset requested. ESP32 will perform hardware reset and verify.");
});

// settings
saveSettings.addEventListener("click", async () => {
  await update(ref(db, basePath), {
    over_voltage_threshold: Number(ovThreshold.value || 260),
    over_current_threshold: Number(ocThreshold.value || 10),
    min_balance_threshold: Number(minBalance.value || 0)
  });
  alert("Settings saved.");
});

// --- end of file ---
