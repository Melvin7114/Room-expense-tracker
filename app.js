
// ==========================================
// ROOMFUND - SHARED EXPENSE TRACKER
// GitHub Pages + Supabase
// ==========================================

const SUPABASE_URL = "https://pdzkypwcbjqyclzsahxq.supabase.co";
const SUPABASE_KEY = "sb_publishable_tkiVh1G0am0foqCAhZPxkg_duDS7xqc";
const ADMIN_USER_ID = "0b0b6464-cb39-48cb-812d-b0c9d1ca5b83";

const STORAGE_KEY = "roomfund_data_v1";
const $ = (id) => document.getElementById(id);

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", {maximumFractionDigits:0});
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

let isAdmin = false;
let cloudReady = false;
let saving = false;
let charts = {};

function sampleData() {
  const members = ["Melvin", "Member 2", "Member 3", "Member 4"]
    .map((name, i) => ({id:"m"+(i+1),name}));

  const tx = [
    ["deposit","m1","Monthly room deposit","Deposit",3000,-12],
    ["deposit","m2","Monthly room deposit","Deposit",3000,-11],
    ["deposit","m3","Monthly room deposit","Deposit",3000,-10],
    ["deposit","m4","Monthly room deposit","Deposit",3000,-9],
    ["expense","m1","Groceries and vegetables","Groceries",1250,-8],
    ["expense","m2","Electricity bill","Electricity",900,-6],
    ["expense","m3","Drinking water cans","Water",250,-4],
    ["expense","m4","Cleaning supplies","Cleaning",350,-2],
    ["expense","m1","Tea and snacks","Food",300,-1]
  ].map((a,i)=>({
    id:"demo"+i,
    type:a[0],
    memberId:a[1],
    description:a[2],
    category:a[3],
    amount:a[4],
    date:shiftDate(a[5]),
    createdAt:Date.now()+i
  }));

  return {members,transactions:tx};
}

function shiftDate(days) {
  const d = new Date();
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.members) && Array.isArray(d.transactions)) return d;
    }
  } catch(e) {
    console.warn(e);
  }
  return sampleData();
}

// Keep the old browser data available in case it needs migration.
const oldLocalData = loadLocalData();

let state = {members:[],transactions:[]};

// ==========================================
// ADMIN LOGIN UI
// ==========================================

function createAccessControls() {
  const topActions = document.querySelector(".top-actions");
  if (!topActions) return;

  if (!$("access-label")) {
    const label = document.createElement("span");
    label.id = "access-label";
    label.textContent = "View only";
    label.style.cssText = "font-size:12px;color:#777;margin-right:8px;";
    topActions.prepend(label);
  }

  if (!$("admin-toggle")) {
    const button = document.createElement("button");
    button.id = "admin-toggle";
    button.textContent = "Admin login";
    button.style.cssText = "padding:9px 13px;border:1px solid #7169e8;border-radius:8px;background:white;color:#7169e8;cursor:pointer;margin-right:8px;";
    topActions.prepend(button);
    button.addEventListener("click", toggleAdmin);
  }

  if (!$("admin-login-dialog")) {
    const dialog = document.createElement("dialog");
    dialog.id = "admin-login-dialog";
    dialog.style.cssText = "border:0;border-radius:14px;padding:24px;width:min(90%,380px);box-shadow:0 15px 50px #0003;";
    dialog.innerHTML = `
      <form id="admin-login-form">
        <h2 style="margin-top:0">RoomFund Admin</h2>
        <p>Sign in with your admin account.</p>
        <label style="display:block;margin:12px 0 5px">Email</label>
        <input id="admin-email" type="email" required autocomplete="username"
          style="box-sizing:border-box;width:100%;padding:11px;border:1px solid #ccc;border-radius:7px">
        <label style="display:block;margin:12px 0 5px">Password</label>
        <input id="admin-password" type="password" required autocomplete="current-password"
          style="box-sizing:border-box;width:100%;padding:11px;border:1px solid #ccc;border-radius:7px">
        <p id="admin-login-error" style="color:#c33;font-size:13px"></p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" id="admin-login-cancel">Cancel</button>
          <button type="submit">Login</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    $("admin-login-form").addEventListener("submit", loginAdmin);
    $("admin-login-cancel").addEventListener("click", () => dialog.close());
  }
}

async function toggleAdmin() {
  if (isAdmin) {
    const {error} = await db.auth.signOut();
    if (error) return toast(error.message);
    isAdmin = false;
    updateAccessUI();
    renderAll();
    toast("Logged out");
  } else {
    $("admin-login-error").textContent = "";
    $("admin-login-form").reset();
    $("admin-login-dialog").showModal();
  }
}

async function loginAdmin(e) {
  e.preventDefault();

  const email = $("admin-email").value.trim();
  const password = $("admin-password").value;
  $("admin-login-error").textContent = "Signing in...";

  const {data,error} = await db.auth.signInWithPassword({email,password});

  if (error) {
    $("admin-login-error").textContent = error.message;
    return;
  }

  if (data.user.id !== ADMIN_USER_ID) {
    await db.auth.signOut();
    $("admin-login-error").textContent = "This account is not authorised as RoomFund admin.";
    return;
  }

  isAdmin = true;
  $("admin-login-dialog").close();
  updateAccessUI();
  renderAll();

  // Migrate existing browser data only if the cloud has no data.
  if (!state.members.length && !state.transactions.length &&
      (oldLocalData.members.length || oldLocalData.transactions.length)) {
    if (confirm("Cloud data is empty. Do you want to upload your existing browser data to RoomFund?")) {
      state = oldLocalData;
      await save();
    }
  }

  toast("Admin login successful");
}

function updateAccessUI() {
  const label = $("access-label");
  const button = $("admin-toggle");

  if (label) label.textContent = isAdmin ? "Admin access" : "View only";
  if (button) button.textContent = isAdmin ? "Logout" : "Admin login";

  document.querySelectorAll('[data-view="data"]').forEach(el => {
    el.style.display = isAdmin ? "" : "none";
  });

  const quickAdd = $("quick-add");
  const addTransaction = $("add-from-transactions");

  if (quickAdd) quickAdd.style.display = isAdmin ? "" : "none";
  if (addTransaction) addTransaction.style.display = isAdmin ? "" : "none";

  const memberHeading = $("view-members")?.querySelector(".section-heading");
  if (memberHeading) {
    let addButton = $("add-member-button");
    if (isAdmin && !addButton) {
      addButton = document.createElement("button");
      addButton.id = "add-member-button";
      addButton.textContent = "+ Add member";
      addButton.className = "primary-btn";
      memberHeading.appendChild(addButton);
      addButton.addEventListener("click", addMember);
    }
    if (addButton) addButton.style.display = isAdmin ? "" : "none";
  }
}

// ==========================================
// SUPABASE CLOUD DATA
// ==========================================

async function loadCloudData() {
  try {
    const {data,error} = await db
      .from("roomfund_data")
      .select("data")
      .eq("id",1)
      .single();

    if (error) throw error;

    const cloudData = data.data;

    if (cloudData &&
        Array.isArray(cloudData.members) &&
        Array.isArray(cloudData.transactions)) {
      state = cloudData;
    }

    cloudReady = true;
    renderAll();
  } catch(error) {
    console.error("Cloud loading error:",error);
    toast("Could not load cloud data. Check your connection.");
  }
}

async function save() {
  if (!isAdmin) {
    toast("Only the admin can make changes");
    return;
  }

  if (!cloudReady) {
    toast("Cloud data is not ready yet");
    return;
  }

  if (saving) {
    toast("Please wait for the previous save");
    return;
  }

  saving = true;

  try {
    const {error} = await db
      .from("roomfund_data")
      .update({
        data:state,
        updated_at:new Date().toISOString()
      })
      .eq("id",1);

    if (error) throw error;

    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    renderAll();
  } catch(error) {
    console.error("Cloud save error:",error);
    toast("Save failed: " + error.message);
  } finally {
    saving = false;
  }
}

// Listen for updates from other phones.
function startRealtime() {
  db.channel("roomfund-live")
    .on(
      "postgres_changes",
      {
        event:"UPDATE",
        schema:"public",
        table:"roomfund_data",
        filter:"id=eq.1"
      },
      payload => {
        if (!payload.new?.data) return;

        state = payload.new.data;

        if (Array.isArray(state.members) &&
            Array.isArray(state.transactions)) {
          renderAll();
          toast("RoomFund updated");
        }
      }
    )
    .subscribe(status => {
      console.log("RoomFund realtime:",status);
    });
}

// ==========================================
// COMMON FUNCTIONS
// ==========================================

function memberName(id) {
  return state.members.find(m=>m.id===id)?.name || "Unknown member";
}

function totals() {
  const deposits = state.transactions
    .filter(t=>t.type==="deposit")
    .reduce((s,t)=>s+t.amount,0);

  const expenses = state.transactions
    .filter(t=>t.type==="expense")
    .reduce((s,t)=>s+t.amount,0);

  return {deposits,expenses,balance:deposits-expenses};
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2400);
}

function moneyDate(s) {
  if (!s) return "—";
  return new Date(s+"T00:00:00").toLocaleDateString("en-IN",{
    day:"2-digit",month:"short",year:"numeric"
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// ==========================================
// NAVIGATION
// ==========================================

function showView(name) {
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $("view-"+name).classList.add("active");

  document.querySelectorAll(".nav-link").forEach(b=>{
    b.classList.toggle("active",b.dataset.view===name);
  });

  $("page-title").textContent = ({
    dashboard:"Dashboard",
    transactions:"Transactions",
    members:"Members",
    reports:"Reports",
    data:"Data & backup"
  })[name];

  if (name==="reports") renderCharts();
}

// ==========================================
// SELECT OPTIONS
// ==========================================

function fillMemberSelects() {
  const options = state.members.map(m=>
    `<option value="${escapeHTML(m.id)}">${escapeHTML(m.name)}</option>`
  ).join("");

  $("entry-member").innerHTML = options;
  $("filter-member").innerHTML = '<option value="">All members</option>'+options;
}

// ==========================================
// DASHBOARD
// ==========================================

function renderDashboard() {
  const t = totals();

  $("total-deposits").textContent = money(t.deposits);
  $("total-expenses").textContent = money(t.expenses);
  $("balance").textContent = money(t.balance);
  $("transaction-count").textContent = state.transactions.length;
  $("report-balance").textContent = money(t.balance);

  const recent = [...state.transactions]
    .sort((a,b)=>(b.date+b.createdAt)-(a.date+a.createdAt))
    .slice(0,6);

  $("recent-list").innerHTML = recent.length
    ? recent.map(x=>`
      <div class="recent-item">
        <div class="transaction-icon">${x.type==="deposit"?"↓":"↗"}</div>
        <div class="recent-info">
          <strong>${escapeHTML(x.description)}</strong>
          <small>${escapeHTML(memberName(x.memberId))} · ${moneyDate(x.date)}</small>
        </div>
        <span class="amount ${x.type==="deposit"?"income":"outgoing"}">
          ${x.type==="deposit"?"+":"−"}${money(x.amount)}
        </span>
      </div>`).join("")
    : '<div class="empty-state">No transactions yet.</div>';

  renderCategoryChart();
}

// ==========================================
// TRANSACTIONS
// ==========================================

function renderTransactions() {
  const search = $("search-input").value.toLowerCase();
  const type = $("filter-type").value;
  const member = $("filter-member").value;
  const cat = $("filter-category").value;
  const from = $("filter-from").value;
  const to = $("filter-to").value;

  const list = [...state.transactions]
    .filter(x=>
      (!search || x.description.toLowerCase().includes(search)) &&
      (!type || x.type===type) &&
      (!member || x.memberId===member) &&
      (!cat || x.category===cat) &&
      (!from || x.date>=from) &&
      (!to || x.date<=to)
    )
    .sort((a,b)=>b.date.localeCompare(a.date));

  $("transaction-rows").innerHTML = list.map(x=>`
    <tr>
      <td>${escapeHTML(x.description)}</td>
      <td>${escapeHTML(memberName(x.memberId))}</td>
      <td>${escapeHTML(x.category||"Deposit")}</td>
      <td>${moneyDate(x.date)}</td>
      <td><span class="type-pill ${x.type}">${x.type}</span></td>
      <td class="right">${x.type==="deposit"?"+":"−"}${money(x.amount)}</td>
      <td>
        ${isAdmin ? `
          <div class="row-actions">
            <button data-edit="${escapeHTML(x.id)}">Edit</button>
            <button data-delete="${escapeHTML(x.id)}">Delete</button>
          </div>` : "View only"}
      </td>
    </tr>
  `).join("");

  $("empty-transactions").classList.toggle("hidden",list.length!==0);
}

// ==========================================
// MEMBERS
// ==========================================

function renderMembers() {
  $("member-cards").innerHTML = state.members.map(m=>{
    const rows = state.transactions.filter(t=>t.memberId===m.id);
    const dep = rows.filter(t=>t.type==="deposit").reduce((s,t)=>s+t.amount,0);
    const spent = rows.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);

    return `
      <article class="member-card">
        <div class="member-head">
          <div class="avatar">${escapeHTML(m.name.slice(0,1).toUpperCase())}</div>
          <div>
            <strong>${escapeHTML(m.name)}</strong>
            <small>${rows.length} transactions</small>
          </div>
        </div>

        <label>Member name</label>
        <input
          ${isAdmin ? "" : "disabled"}
          data-rename="${escapeHTML(m.id)}"
          value="${escapeHTML(m.name)}"
          maxlength="30"
        />

        <div class="member-metrics">
          <div><small>Deposited</small><strong>${money(dep)}</strong></div>
          <div><small>Spent</small><strong>${money(spent)}</strong></div>
          <div><small>Net</small><strong>${money(dep-spent)}</strong></div>
        </div>

        ${isAdmin ? `<button data-remove-member="${escapeHTML(m.id)}">Remove member</button>` : ""}
      </article>`;
  }).join("");
}

function addMember() {
  if (!isAdmin) return;

  const name = prompt("Enter the new member's name:");
  if (!name || !name.trim()) return;

  if (state.members.some(m=>m.name.toLowerCase()===name.trim().toLowerCase())) {
    return toast("Member already exists");
  }

  state.members.push({id:uid(),name:name.trim()});
  save();
  toast("Member added");
}

function removeMember(id) {
  if (!isAdmin) return;

  const member = state.members.find(m=>m.id===id);
  if (!member) return;

  if (state.transactions.some(t=>t.memberId===id)) {
    return alert("This member has transactions. Remove or reassign those transactions first.");
  }

  if (!confirm(`Remove ${member.name}?`)) return;

  state.members = state.members.filter(m=>m.id!==id);
  save();
  toast("Member removed");
}

// ==========================================
// CHARTS
// ==========================================

function chart(id,type,data,options={}) {
  if (charts[id]) charts[id].destroy();

  const canvas = $(id);
  if (!canvas || typeof Chart==="undefined") return;

  charts[id] = new Chart(canvas,{
    type,
    data,
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{
          display:type==="doughnut",
          position:"bottom",
          labels:{boxWidth:8,font:{size:10}}
        }
      },
      scales:type==="doughnut" ? {} : {
        x:{grid:{display:false},ticks:{font:{size:9}}},
        y:{beginAtZero:true,grid:{color:"#eef0f5"},ticks:{font:{size:9}}}
      },
      ...options
    }
  });
}

function renderCategoryChart() {
  const sums = {};

  state.transactions
    .filter(t=>t.type==="expense")
    .forEach(t=>{
      sums[t.category||"Other"] = (sums[t.category||"Other"]||0)+t.amount;
    });

  const labels = Object.keys(sums);
  const values = Object.values(sums);

  chart("category-chart","doughnut",{
    labels,
    datasets:[{
      data:values,
      backgroundColor:["#7169e8","#29a985","#f0a35b","#5b9ad6","#df7184","#9b83c8","#70b9c0","#b7a16a"],
      borderWidth:0
    }]
  },{cutout:"68%"});

  $("category-legend").innerHTML = labels.map((l,i)=>`
    <span class="legend-item">
      <i class="legend-dot" style="background:${["#7169e8","#29a985","#f0a35b","#5b9ad6","#df7184","#9b83c8","#70b9c0","#b7a16a"][i%8]}"></i>
      ${escapeHTML(l)} · ${money(values[i])}
    </span>
  `).join("");
}

function renderCharts() {
  const days = Array.from({length:14},(_,i)=>shiftDate(i-13));

  const daily = days.map(d=>
    state.transactions
      .filter(t=>t.type==="expense"&&t.date===d)
      .reduce((s,t)=>s+t.amount,0)
  );

  chart("daily-chart","bar",{
    labels:days.map(d=>new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})),
    datasets:[{
      label:"Expenses",
      data:daily,
      backgroundColor:"#7169e8",
      borderRadius:5
    }]
  });

  const months = Array.from({length:6},(_,i)=>{
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth()-5+i);
    return d.toISOString().slice(0,7);
  });

  const labels = months.map(m=>
    new Date(m+"-01T00:00:00").toLocaleDateString("en-IN",{month:"short",year:"2-digit"})
  );

  const dep = months.map(m=>
    state.transactions.filter(t=>t.type==="deposit"&&t.date.startsWith(m))
      .reduce((s,t)=>s+t.amount,0)
  );

  const exp = months.map(m=>
    state.transactions.filter(t=>t.type==="expense"&&t.date.startsWith(m))
      .reduce((s,t)=>s+t.amount,0)
  );

  chart("monthly-chart","bar",{
    labels,
    datasets:[
      {label:"Deposits",data:dep,backgroundColor:"#29a985",borderRadius:4},
      {label:"Expenses",data:exp,backgroundColor:"#f0a35b",borderRadius:4}
    ]
  },{plugins:{legend:{position:"bottom",labels:{font:{size:10},boxWidth:8}}}});

  chart("member-chart","bar",{
    labels:state.members.map(m=>m.name),
    datasets:[{
      label:"Contributions",
      data:state.members.map(m=>
        state.transactions.filter(t=>t.type==="deposit"&&t.memberId===m.id)
          .reduce((s,t)=>s+t.amount,0)
      ),
      backgroundColor:"#7169e8",
      borderRadius:5
    }]
  });
}

// ==========================================
// RENDER EVERYTHING
// ==========================================

function renderAll() {
  fillMemberSelects();
  renderDashboard();
  renderTransactions();
  renderMembers();

  if ($("view-reports").classList.contains("active")) renderCharts();

  const cats = [...new Set(
    state.transactions.filter(t=>t.type==="expense").map(t=>t.category||"Other")
  )];

  $("filter-category").innerHTML =
    '<option value="">All categories</option>'+
    cats.map(c=>`<option>${escapeHTML(c)}</option>`).join("");

  updateAccessUI();
}

// ==========================================
// TRANSACTION DIALOG
// ==========================================

function openDialog(tx=null) {
  if (!isAdmin) return toast("Admin access required");

  $("transaction-form").reset();
  $("form-error").textContent = "";
  $("edit-id").value = tx?.id||"";
  $("dialog-title").textContent = tx ? "Edit transaction" : "Add transaction";
  $("entry-type").value = tx?.type||"expense";
  $("entry-member").value = tx?.memberId||state.members[0]?.id||"";
  $("entry-description").value = tx?.description||"";
  $("entry-amount").value = tx?.amount||"";
  $("entry-date").value = tx?.date||todayISO();
  $("entry-category").value = tx?.category||"Food";
  $("category-field").style.display = $("entry-type").value==="deposit" ? "none" : "block";

  $("transaction-dialog").showModal();
}

function closeDialog() {
  $("transaction-dialog").close();
}

$("entry-type").addEventListener("change",()=>{
  $("category-field").style.display =
    $("entry-type").value==="deposit" ? "none" : "block";
});

$("transaction-form").addEventListener("submit",async e=>{
  e.preventDefault();
  if (!isAdmin) return;

  const id = $("edit-id").value;
  const type = $("entry-type").value;
  const memberId = $("entry-member").value;
  const description = $("entry-description").value.trim();
  const amount = Number($("entry-amount").value);
  const date = $("entry-date").value;
  const category = type==="deposit" ? "Deposit" : $("entry-category").value;

  if (!description || !date || !Number.isFinite(amount) || amount<=0) {
    $("form-error").textContent = "Enter a description, valid date and amount greater than zero.";
    return;
  }

  if (!memberId) {
    $("form-error").textContent = "Please add a member first.";
    return;
  }

  const old = state.transactions.find(t=>t.id===id);

  const candidate = {
    id:id||uid(),
    type,
    memberId,
    description,
    amount,
    date,
    category,
    createdAt:old?.createdAt||Date.now()
  };

  const others = state.transactions.filter(t=>t.id!==id);

  const deposits = others.filter(t=>t.type==="deposit")
    .reduce((s,t)=>s+t.amount,0)+(type==="deposit"?amount:0);

  const expenses = others.filter(t=>t.type==="expense")
    .reduce((s,t)=>s+t.amount,0)+(type==="expense"?amount:0);

  if (expenses>deposits) {
    $("form-error").textContent = "Not enough group balance for this transaction. Add a deposit first.";
    return;
  }

  if (id) {
    state.transactions = state.transactions.map(t=>t.id===id?candidate:t);
  } else {
    state.transactions.push(candidate);
  }

  closeDialog();
  await save();
  toast(id?"Transaction updated":"Transaction added");
});

// ==========================================
// DELETE TRANSACTION
// ==========================================

async function deleteTransaction(id) {
  if (!isAdmin) return;

  const tx = state.transactions.find(t=>t.id===id);
  if (!tx) return;

  if (!confirm(`Delete "${tx.description}" (${money(tx.amount)})?`)) return;

  state.transactions = state.transactions.filter(t=>t.id!==id);
  await save();
  toast("Transaction deleted");
}

// ==========================================
// EVENT LISTENERS
// ==========================================

document.addEventListener("click",e=>{
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  const remove = e.target.closest("[data-remove-member]");
  const go = e.target.closest("[data-go]");

  if (edit && isAdmin) {
    openDialog(state.transactions.find(t=>t.id===edit.dataset.edit));
  }

  if (del && isAdmin) deleteTransaction(del.dataset.delete);
  if (remove && isAdmin) removeMember(remove.dataset.removeMember);
  if (go) showView(go.dataset.go);
});

["search-input","filter-type","filter-member","filter-category","filter-from","filter-to"]
  .forEach(id=>$(id).addEventListener("input",renderTransactions));

$("clear-filters").addEventListener("click",()=>{
  ["search-input","filter-type","filter-member","filter-category","filter-from","filter-to"]
    .forEach(id=>$(id).value="");
  renderTransactions();
});

$("member-cards").addEventListener("change",async e=>{
  const input = e.target.closest("[data-rename]");
  if (!input || !isAdmin) return;

  const name = input.value.trim();

  if (!name) {
    input.value = memberName(input.dataset.rename);
    return;
  }

  const member = state.members.find(m=>m.id===input.dataset.rename);
  if (!member) return;

  member.name = name;
  await save();
  toast("Member name updated");
});

document.querySelectorAll(".nav-link").forEach(b=>{
  b.addEventListener("click",()=>showView(b.dataset.view));
});

$("quick-add").addEventListener("click",()=>openDialog());
$("add-from-transactions").addEventListener("click",()=>openDialog());
$("close-dialog").addEventListener("click",closeDialog);
$("cancel-dialog").addEventListener("click",closeDialog);

// ==========================================
// EXPORT / IMPORT / RESET
// ==========================================

$("export-data").addEventListener("click",()=>{
  if (!isAdmin) return;

  const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "roomfund-backup-"+todayISO()+".json";
  a.click();

  URL.revokeObjectURL(url);
  toast("Backup downloaded");
});

$("import-data").addEventListener("change",async e=>{
  if (!isAdmin) return;

  const file = e.target.files[0];
  if (!file) return;

  try {
    const d = JSON.parse(await file.text());

    if (!Array.isArray(d.members)||!Array.isArray(d.transactions)) {
      throw Error("Invalid backup");
    }

    if (!confirm("Importing replaces all current data. Continue?")) return;

    state = d;
    await save();
    toast("Backup restored");
  } catch(err) {
    alert("Could not import this file. Please choose a valid RoomFund backup.");
  }

  e.target.value = "";
});

$("reset-demo").addEventListener("click",async()=>{
  if (!isAdmin) return;

  if (confirm("Replace all current data with sample demo data?")) {
    state = sampleData();
    await save();
    toast("Demo data restored");
  }
});

$("clear-data").addEventListener("click",async()=>{
  if (!isAdmin) return;

  if (confirm("Permanently clear all transactions?")) {
    state = {members:state.members,transactions:[]};
    await save();
    toast("All transactions cleared");
  }
});

// ==========================================
// START APPLICATION
// ==========================================

async function startRoomFund() {
  createAccessControls();

  $("today-label").textContent = new Date().toLocaleDateString("en-IN",{
    weekday:"short",day:"numeric",month:"short",year:"numeric"
  });

  // Check whether an admin session already exists.
  const {data} = await db.auth.getSession();

  if (data.session?.user?.id===ADMIN_USER_ID) {
    isAdmin = true;
  }

  updateAccessUI();

  // Load the shared data.
  await loadCloudData();

  // Enable live updates from other devices.
  startRealtime();

  // Keep admin status updated when signing in or out.
  db.auth.onAuthStateChange((_event,session)=>{
    isAdmin = session?.user?.id===ADMIN_USER_ID;
    updateAccessUI();
    renderAll();
  });
}

startRoomFund();
