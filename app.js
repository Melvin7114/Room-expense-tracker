const STORAGE_KEY = "roomfund_data_v1";
const $ = (id) => document.getElementById(id);
const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", {maximumFractionDigits:0});
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function sampleData() {
  const members = ["Melvin", "Member 2", "Member 3", "Member 4"].map((name, i) => ({id:"m"+(i+1),name}));
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
  ].map((a,i)=>({id:"demo"+i,type:a[0],memberId:a[1],description:a[2],category:a[3],amount:a[4],date:shiftDate(a[5]),createdAt:Date.now()+i}));
  return {members,transactions:tx};
}
function shiftDate(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function loadData(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const d=JSON.parse(raw);if(Array.isArray(d.members)&&Array.isArray(d.transactions))return d}}catch(e){console.warn(e)}return sampleData()}
let state=loadData(), charts={};
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function memberName(id){return state.members.find(m=>m.id===id)?.name||"Unknown member"}
function totals(){const deposits=state.transactions.filter(t=>t.type==="deposit").reduce((s,t)=>s+t.amount,0);const expenses=state.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);return {deposits,expenses,balance:deposits-expenses}}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)}
function moneyDate(s){if(!s)return "—";return new Date(s+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$("view-"+name).classList.add("active");document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===name));$("page-title").textContent=({dashboard:"Dashboard",transactions:"Transactions",members:"Members",reports:"Reports",data:"Data & backup"})[name];if(name==="reports")renderCharts()}
function fillMemberSelects(){const options=state.members.map(m=>`<option value="${m.id}">${escapeHTML(m.name)}</option>`).join("");$("entry-member").innerHTML=options;$("filter-member").innerHTML='<option value="">All members</option>'+options}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderDashboard(){
 const t=totals();$("total-deposits").textContent=money(t.deposits);$("total-expenses").textContent=money(t.expenses);$("balance").textContent=money(t.balance);$("transaction-count").textContent=state.transactions.length;$("report-balance").textContent=money(t.balance);
 const recent=[...state.transactions].sort((a,b)=>(b.date+b.createdAt)-(a.date+a.createdAt)).slice(0,6);
 $("recent-list").innerHTML=recent.length?recent.map(x=>`<div class="recent-item"><div class="transaction-icon">${x.type==="deposit"?"↓":"↗"}</div><div class="recent-info"><strong>${escapeHTML(x.description)}</strong><small>${escapeHTML(memberName(x.memberId))} · ${moneyDate(x.date)}</small></div><span class="amount ${x.type==="deposit"?"income":"outgoing"}">${x.type==="deposit"?"+":"−"}${money(x.amount)}</span></div>`).join(""):'<div class="empty-state">No transactions yet.</div>';
 renderCategoryChart();
}
function renderTransactions(){
 const search=$("search-input").value.toLowerCase(),type=$("filter-type").value,member=$("filter-member").value,cat=$("filter-category").value,from=$("filter-from").value,to=$("filter-to").value;
 const list=[...state.transactions].filter(x=>(!search||x.description.toLowerCase().includes(search))&&(!type||x.type===type)&&(!member||x.memberId===member)&&(!cat||x.category===cat)&&(!from||x.date>=from)&&(!to||x.date<=to)).sort((a,b)=>b.date.localeCompare(a.date));
 $("transaction-rows").innerHTML=list.map(x=>`<tr><td>${escapeHTML(x.description)}</td><td>${escapeHTML(memberName(x.memberId))}</td><td>${escapeHTML(x.category||"Deposit")}</td><td>${moneyDate(x.date)}</td><td><span class="type-pill ${x.type}">${x.type}</span></td><td class="right">${x.type==="deposit"?"+":"−"}${money(x.amount)}</td><td><div class="row-actions"><button data-edit="${x.id}">Edit</button><button data-delete="${x.id}">Delete</button></div></td></tr>`).join("");
 $("empty-transactions").classList.toggle("hidden",list.length!==0);
}
function renderMembers(){
 $("member-cards").innerHTML=state.members.map(m=>{const rows=state.transactions.filter(t=>t.memberId===m.id),dep=rows.filter(t=>t.type==="deposit").reduce((s,t)=>s+t.amount,0),spent=rows.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);return `<article class="member-card"><div class="member-head"><div class="avatar">${escapeHTML(m.name.slice(0,1).toUpperCase())}</div><div><strong>${escapeHTML(m.name)}</strong><small>${rows.length} transactions</small></div></div><label>Member name</label><input data-rename="${m.id}" value="${escapeHTML(m.name)}" maxlength="30"/><div class="member-metrics"><div><small>Deposited</small><strong>${money(dep)}</strong></div><div><small>Spent</small><strong>${money(spent)}</strong></div><div><small>Net</small><strong>${money(dep-spent)}</strong></div></div></article>`}).join("");
}
function chart(id,type,data,options={}){if(charts[id])charts[id].destroy();const canvas=$(id);if(!canvas||typeof Chart==="undefined")return;charts[id]=new Chart(canvas,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="doughnut",position:"bottom",labels:{boxWidth:8,font:{size:10}}}},scales:type==="doughnut"?{}:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{beginAtZero:true,grid:{color:"#eef0f5"},ticks:{font:{size:9}}}},...options}})}
function renderCategoryChart(){
 const sums={};state.transactions.filter(t=>t.type==="expense").forEach(t=>sums[t.category||"Other"]=(sums[t.category||"Other"]||0)+t.amount);
 const labels=Object.keys(sums),values=Object.values(sums);chart("category-chart","doughnut",{labels,datasets:[{data:values,backgroundColor:["#7169e8","#29a985","#f0a35b","#5b9ad6","#df7184","#9b83c8","#70b9c0","#b7a16a"],borderWidth:0}]},{cutout:"68%"});
 $("category-legend").innerHTML=labels.map((l,i)=>`<span class="legend-item"><i class="legend-dot" style="background:${["#7169e8","#29a985","#f0a35b","#5b9ad6","#df7184","#9b83c8","#70b9c0","#b7a16a"][i%8]}"></i>${escapeHTML(l)} · ${money(values[i])}</span>`).join("");
}
function renderCharts(){
 const days=Array.from({length:14},(_,i)=>shiftDate(i-13)),daily=days.map(d=>state.transactions.filter(t=>t.type==="expense"&&t.date===d).reduce((s,t)=>s+t.amount,0));
 chart("daily-chart","bar",{labels:days.map(d=>new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})),datasets:[{label:"Expenses",data:daily,backgroundColor:"#7169e8",borderRadius:5}]});
 const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-5+i);return d.toISOString().slice(0,7)}),labels=months.map(m=>new Date(m+"-01T00:00:00").toLocaleDateString("en-IN",{month:"short",year:"2-digit"}));
 const dep=months.map(m=>state.transactions.filter(t=>t.type==="deposit"&&t.date.startsWith(m)).reduce((s,t)=>s+t.amount,0)),exp=months.map(m=>state.transactions.filter(t=>t.type==="expense"&&t.date.startsWith(m)).reduce((s,t)=>s+t.amount,0));
 chart("monthly-chart","bar",{labels,datasets:[{label:"Deposits",data:dep,backgroundColor:"#29a985",borderRadius:4},{label:"Expenses",data:exp,backgroundColor:"#f0a35b",borderRadius:4}]},{plugins:{legend:{position:"bottom",labels:{font:{size:10},boxWidth:8}}}});
 chart("member-chart","bar",{labels:state.members.map(m=>m.name),datasets:[{label:"Contributions",data:state.members.map(m=>state.transactions.filter(t=>t.type==="deposit"&&t.memberId===m.id).reduce((s,t)=>s+t.amount,0)),backgroundColor:"#7169e8",borderRadius:5}]});
}
function renderAll(){fillMemberSelects();renderDashboard();renderTransactions();renderMembers();if($("view-reports").classList.contains("active"))renderCharts();const cats=[...new Set(state.transactions.filter(t=>t.type==="expense").map(t=>t.category||"Other"))];$("filter-category").innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${escapeHTML(c)}</option>`).join("")}
function openDialog(tx=null){
 $("transaction-form").reset();$("form-error").textContent="";$("edit-id").value=tx?.id||"";$("dialog-title").textContent=tx?"Edit transaction":"Add transaction";$("entry-type").value=tx?.type||"expense";$("entry-member").value=tx?.memberId||state.members[0]?.id;$("entry-description").value=tx?.description||"";$("entry-amount").value=tx?.amount||"";$("entry-date").value=tx?.date||todayISO();$("entry-category").value=tx?.category||"Food";$("category-field").style.display=$("entry-type").value==="deposit"?"none":"block";$("transaction-dialog").showModal();
}
function closeDialog(){$("transaction-dialog").close()}
$("entry-type").addEventListener("change",()=>$("category-field").style.display=$("entry-type").value==="deposit"?"none":"block");
$("transaction-form").addEventListener("submit",e=>{
 e.preventDefault();const id=$("edit-id").value,type=$("entry-type").value,memberId=$("entry-member").value,description=$("entry-description").value.trim(),amount=Number($("entry-amount").value),date=$("entry-date").value,category=type==="deposit"?"Deposit":$("entry-category").value;
 if(!description||!date||!Number.isFinite(amount)||amount<=0){$("form-error").textContent="Enter a description, valid date and amount greater than zero.";return}
 const old=state.transactions.find(t=>t.id===id),candidate={id:id||uid(),type,memberId,description,amount,date,category,createdAt:old?.createdAt||Date.now()};
 const others=state.transactions.filter(t=>t.id!==id),deposits=others.filter(t=>t.type==="deposit").reduce((s,t)=>s+t.amount,0)+(type==="deposit"?amount:0),expenses=others.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0)+(type==="expense"?amount:0);
 if(expenses>deposits){$("form-error").textContent="Not enough group balance for this transaction. Add a deposit first.";return}
 if(id)state.transactions=state.transactions.map(t=>t.id===id?candidate:t);else state.transactions.push(candidate);
 closeDialog();save();toast(id?"Transaction updated":"Transaction added");
});
function deleteTransaction(id){const tx=state.transactions.find(t=>t.id===id);if(!tx)return;if(!confirm(`Delete "${tx.description}" (${money(tx.amount)})?`))return;state.transactions=state.transactions.filter(t=>t.id!==id);save();toast("Transaction deleted")}
document.addEventListener("click",e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit)openDialog(state.transactions.find(t=>t.id===edit.dataset.edit));if(del)deleteTransaction(del.dataset.delete);const go=e.target.closest("[data-go]");if(go)showView(go.dataset.go)});
$("transaction-rows").addEventListener("click",()=>{});["search-input","filter-type","filter-member","filter-category","filter-from","filter-to"].forEach(id=>$(id).addEventListener("input",renderTransactions));
$("clear-filters").addEventListener("click",()=>{["search-input","filter-type","filter-member","filter-category","filter-from","filter-to"].forEach(id=>$(id).value="");renderTransactions()});
$("member-cards").addEventListener("change",e=>{const input=e.target.closest("[data-rename]");if(!input)return;const name=input.value.trim();if(!name){input.value=memberName(input.dataset.rename);return}state.members.find(m=>m.id===input.dataset.rename).name=name;save();toast("Member name updated")});
document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$("quick-add").addEventListener("click",()=>openDialog());$("add-from-transactions").addEventListener("click",()=>openDialog());$("close-dialog").addEventListener("click",closeDialog);$("cancel-dialog").addEventListener("click",closeDialog);
$("export-data").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="roomfund-backup-"+todayISO()+".json";a.click();URL.revokeObjectURL(url);toast("Backup downloaded")});
$("import-data").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(!Array.isArray(d.members)||!Array.isArray(d.transactions))throw Error("Invalid backup");if(!confirm("Importing replaces all current data. Continue?"))return;state=d;save();toast("Backup restored")}catch(err){alert("Could not import this file. Please choose a valid RoomFund backup.")}e.target.value=""});
$("reset-demo").addEventListener("click",()=>{if(confirm("Replace all current data with sample demo data?")){state=sampleData();save();toast("Demo data restored")}});
$("clear-data").addEventListener("click",()=>{if(confirm("Permanently clear all members and transactions from this browser?")){state={members:state.members,transactions:[]};save();toast("All transactions cleared")}});
$("today-label").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
renderAll();
