"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Json = Record<string, any>;

type Batch = {
  id: string;
  psLotNumber: string;
  batchStatus: string;
  testingStatus: string;
  quantityReceived: number;
  quantityReserved: number;
  quantityFulfilled: number;
  quantityQuarantined: number;
  quantityAvailable: number;
  holdReason?: string | null;
  recalledReason?: string | null;
  product: { name: string; sku?: string | null; lotCode: string };
  manufacturerBatch: { manufacturerLotNumber: string; expirationOrRetestDate?: string | null };
  documents: Array<{ id: string; documentType: string; approved: boolean; publicVisible: boolean; supersededAt?: string | null }>;
};

const API_KEY_STORAGE = "ps_admin_api_key";
const ADMIN_USER_STORAGE = "ps_admin_user";

function statusTone(status: string) {
  if (["ACTIVE", "APPROVED", "INDEPENDENT_VERIFIED"].includes(status)) return "good";
  if (["HOLD", "RECALLED", "REVIEW_REQUIRED"].includes(status)) return "bad";
  if (["PENDING_DOCUMENTATION", "PENDING_INDEPENDENT_TESTING", "INDEPENDENT_PENDING"].includes(status)) return "warn";
  return "neutral";
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState("");
  const [adminUser, setAdminUser] = useState("admin:dashboard");
  const [connected, setConnected] = useState(false);
  const [launch, setLaunch] = useState<Json | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    setApiKey(sessionStorage.getItem(API_KEY_STORAGE) || "");
    setAdminUser(sessionStorage.getItem(ADMIN_USER_STORAGE) || "admin:dashboard");
  }, []);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${apiKey}`,
    "X-PS-Admin-User": adminUser || "admin:dashboard",
  }), [apiKey, adminUser]);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);
    return data;
  }

  async function loadAll() {
    setBusy(true); setMessage("");
    try {
      const [launchData, batchData, docData, orderData, productData] = await Promise.all([
        api("/api/admin/launch-status"),
        api("/api/batches"),
        api("/api/admin/documents?approval=pending"),
        api("/api/admin/order-lots"),
        api("/api/admin/products"),
      ]);
      setLaunch(launchData);
      setBatches(batchData.batches || []);
      setDocuments(docData.documents || []);
      setAssignments(orderData.assignments || []);
      setProducts(productData.products || []);
      setConnected(true);
      sessionStorage.setItem(API_KEY_STORAGE, apiKey);
      sessionStorage.setItem(ADMIN_USER_STORAGE, adminUser || "admin:dashboard");
    } catch (error) {
      setConnected(false);
      setMessage(error instanceof Error ? error.message : "Unable to load admin data");
    } finally { setBusy(false); }
  }

  async function connect(e: FormEvent) { e.preventDefault(); await loadAll(); }

  async function batchAction(batch: Batch, action: "approve" | "activate" | "hold" | "release" | "recall") {
    let body: Json | undefined;
    if (action === "hold" || action === "recall") {
      const reason = window.prompt(`${action === "hold" ? "Hold" : "Recall"} reason for ${batch.psLotNumber}:`);
      if (!reason) return;
      body = { reason };
    } else if (action === "release") {
      const reason = window.prompt(`Optional release note for ${batch.psLotNumber}:`) || undefined;
      body = reason ? { reason } : {};
    }
    if (action === "recall" && !window.confirm(`RECALL ${batch.psLotNumber}? This will release open reservations and publish recall status.`)) return;
    setBusy(true); setMessage("");
    try {
      await api(`/api/batches/${batch.id}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      setMessage(`${batch.psLotNumber}: ${action} completed.`);
      await loadAll();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action failed"); }
    finally { setBusy(false); }
  }

  async function approveDocument(id: string) {
    setBusy(true); setMessage("");
    try {
      await api(`/api/documents/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setMessage("Document approved.");
      await loadAll();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Document approval failed"); }
    finally { setBusy(false); }
  }

  async function orderAction(assignment: any, action: "return" | "correct") {
    if (action === "return") {
      const max = assignment.quantity - (assignment.quantityReturned || 0);
      const raw = window.prompt(`Return quantity for ${assignment.psBatch.psLotNumber} (max ${max}):`, String(max));
      if (!raw) return;
      const quantity = Number(raw);
      const reason = window.prompt("Return/quarantine reason:");
      if (!reason) return;
      setBusy(true); setMessage("");
      try { await api(`/api/order-lots/${assignment.id}/return`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({quantity,reason}) }); setMessage("Returned inventory recorded in quarantine."); await loadAll(); }
      catch(error){ setMessage(error instanceof Error?error.message:"Return failed"); } finally { setBusy(false); }
      return;
    }
    const targetLot=window.prompt(`Correct ${assignment.psBatch.psLotNumber} to which Peptide Society lot?`);
    if(!targetLot)return;
    const target=batches.find((b)=>b.psLotNumber.toUpperCase()===targetLot.trim().toUpperCase());
    if(!target){setMessage("Target lot is not in the current batch list.");return;}
    const reason=window.prompt("Correction reason (audited):"); if(!reason)return;
    if(!window.confirm(`Replace fulfilled lot ${assignment.psBatch.psLotNumber} with ${target.psLotNumber}?`))return;
    setBusy(true); setMessage("");
    try { await api(`/api/order-lots/${assignment.id}/correct`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({targetBatchId:target.id,reason}) }); setMessage("Fulfilled lot correction recorded and Shopify order updated."); await loadAll(); }
    catch(error){ setMessage(error instanceof Error?error.message:"Correction failed"); } finally { setBusy(false); }
  }

  if (!connected) return (
    <main className="ps-admin-login">
      <form className="ps-login-card" onSubmit={connect}>
        <div className="ps-logo">PS</div>
        <p className="eyebrow">PEPTIDE SOCIETY</p>
        <h1>Operations Control Center</h1>
        <p className="muted">Internal access only. The admin key is kept in this browser session and is never written into the storefront.</p>
        <label>Admin API Key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" required /></label>
        <label>Audit User<input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} maxLength={100} /></label>
        <button disabled={busy}>{busy ? "Connecting…" : "Open Control Center"}</button>
        {message && <div className="error">{message}</div>}
      </form>
      <style jsx global>{styles}</style>
    </main>
  );

  const visibleBatches = filter === "ALL" ? batches : batches.filter((b) => b.batchStatus === filter);
  const blockers = [...(launch?.blockers?.technical || []), ...(launch?.blockers?.data || [])];

  return (
    <main className="ps-admin">
      <header className="topbar">
        <div className="brand"><span className="ps-logo small">PS</span><div><b>Peptide Society</b><small>Operations Control Center</small></div></div>
        <div className="top-actions"><span className={`launch-pill ${launch?.technicalReady && launch?.inventoryReady ? "ready" : "blocked"}`}>{launch?.technicalReady && launch?.inventoryReady ? "TECHNICALLY READY" : "BUILD / DATA BLOCKED"}</span><button className="secondary" onClick={loadAll} disabled={busy}>Refresh</button><button className="secondary" onClick={() => { sessionStorage.removeItem(API_KEY_STORAGE); setConnected(false); }}>Lock</button></div>
      </header>

      <section className="hero-row">
        <div><p className="eyebrow">OCTOBER 15, 2026 LAUNCH TARGET</p><h1>Launch command center.</h1><p className="muted">One view for inventory release, documentation, lot assignment, holds, recalls, and launch blockers.</p></div>
        <div className="target"><small>TARGET</small><strong>OCT 15</strong><span>{launch?.generatedAt ? `Snapshot ${new Date(launch.generatedAt).toLocaleString()}` : ""}</span></div>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="metrics">
        <Metric label="Active batches" value={launch?.counts?.activeBatches ?? 0} tone="good" />
        <Metric label="Blocked batches" value={launch?.counts?.blockedBatches ?? 0} tone={(launch?.counts?.blockedBatches ?? 0) ? "warn" : "good"} />
        <Metric label="Docs awaiting review" value={launch?.counts?.unapprovedDocuments ?? 0} tone={(launch?.counts?.unapprovedDocuments ?? 0) ? "warn" : "good"} />
        <Metric label="Reserved assignments" value={launch?.counts?.reservedAssignments ?? 0} />
        <Metric label="Recalled batches" value={launch?.counts?.recalledBatches ?? 0} tone={(launch?.counts?.recalledBatches ?? 0) ? "bad" : "neutral"} />
        <Metric label="Inventory audit" value={launch?.counts?.inventoryInvariantViolations ?? 0} tone={(launch?.counts?.inventoryInvariantViolations ?? 0) ? "bad" : "good"} />
      </section>

      <section className="grid two">
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">GO / NO-GO</p><h2>Launch blockers</h2></div><span className={`dot ${blockers.length ? "bad" : "good"}`}></span></div>
          {blockers.length ? <ul className="blockers">{blockers.map((b: string) => <li key={b}>{b}</li>)}</ul> : <p className="success">Technical and batch-data gates currently clear.</p>}
          <details><summary>External gates ({launch?.blockers?.external?.length || 0})</summary><ul className="blockers external">{(launch?.blockers?.external || []).map((b: string) => <li key={b}>{b}</li>)}</ul></details>
        </article>

        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">CATALOG SYNC</p><h2>Products</h2></div><b>{products.length}</b></div>
          <div className="compact-list">{products.slice(0, 8).map((p) => <div key={p.id}><span><b>{p.name}</b><small>{p.sku || "No SKU"} · LOT {p.lotCode}</small></span><span><b>{p._count?.psBatches || 0}</b><small>batches</small></span></div>)}</div>
        </article>
      </section>

      <section className="panel batches-panel">
        <div className="panel-head responsive"><div><p className="eyebrow">BATCH OPERATIONS</p><h2>Release queue</h2></div><div className="filters">{["ALL","PENDING_DOCUMENTATION","PENDING_INDEPENDENT_TESTING","APPROVED","ACTIVE","HOLD","RECALLED"].map(s => <button key={s} className={filter === s ? "selected" : ""} onClick={() => setFilter(s)}>{s.replaceAll("_"," ")}</button>)}</div></div>
        <div className="table-wrap"><table><thead><tr><th>Lot</th><th>Product</th><th>Status</th><th>Inventory</th><th>Docs</th><th>Manufacturer lot</th><th>Actions</th></tr></thead><tbody>{visibleBatches.map((b) => <tr key={b.id}><td><b>{b.psLotNumber}</b></td><td>{b.product.name}<small>{b.product.sku}</small></td><td><span className={`status ${statusTone(b.batchStatus)}`}>{b.batchStatus.replaceAll("_"," ")}</span><small>{b.testingStatus.replaceAll("_"," ")}</small></td><td><b>{b.quantityAvailable}</b> available<small>{b.quantityReserved} reserved · {b.quantityFulfilled} fulfilled · {b.quantityQuarantined || 0} quarantined</small></td><td>{b.documents.filter(d => d.approved && !d.supersededAt).length} approved<small>{b.documents.length} total</small></td><td>{b.manufacturerBatch.manufacturerLotNumber}</td><td><div className="row-actions">{b.batchStatus.startsWith("PENDING") && <button onClick={() => batchAction(b,"approve")}>Approve</button>}{b.batchStatus === "APPROVED" && <button onClick={() => batchAction(b,"activate")}>Activate</button>}{!["HOLD","RECALLED","ARCHIVED","DEPLETED"].includes(b.batchStatus) && <button onClick={() => batchAction(b,"hold")}>Hold</button>}{b.batchStatus === "HOLD" && <button onClick={() => batchAction(b,"release")}>Release</button>}{!["RECALLED","ARCHIVED"].includes(b.batchStatus) && <button className="danger" onClick={() => batchAction(b,"recall")}>Recall</button>}</div></td></tr>)}</tbody></table>{!visibleBatches.length && <div className="empty">No batches match this view.</div>}</div>
      </section>

      <section className="grid two">
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">DOCUMENT REVIEW</p><h2>Awaiting approval</h2></div><b>{documents.length}</b></div>
          <div className="review-list">{documents.slice(0, 12).map((d) => <div key={d.id}><span><b>{d.psBatch.product.name}</b><small>{d.psBatch.psLotNumber} · {d.documentType.replaceAll("_"," ")} · v{d.versionNumber}</small></span><button onClick={() => approveDocument(d.id)}>Approve</button></div>)}{!documents.length && <p className="success">No documents waiting for approval.</p>}</div>
        </article>
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">ORDER TRACEABILITY</p><h2>Recent lot assignments</h2></div><b>{assignments.length}</b></div>
          <div className="compact-list">{assignments.slice(0, 12).map((a) => <div key={a.id}><span><b>{a.product.name}</b><small>{a.psBatch.psLotNumber} · {a.quantity} unit(s){a.quantityReturned ? ` · ${a.quantityReturned} returned/quarantined` : ""}</small></span><span><span className={`status ${statusTone(a.status)}`}>{a.status}</span><small>{String(a.shopifyOrderId).split("/").pop()}</small>{a.status === "FULFILLED" && <div className="row-actions" style={{marginTop:6}}><button onClick={()=>orderAction(a,"return")}>Return</button><button onClick={()=>orderAction(a,"correct")}>Correct lot</button></div>}</span></div>)}{!assignments.length && <p className="muted">No order-lot assignments yet.</p>}</div>
        </article>
      </section>

      <footer>Internal operations interface · Batch actions are audit logged · Public verification remains separate.</footer>
      <style jsx global>{styles}</style>
    </main>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: string }) {
  return <div className={`metric ${tone}`}><small>{label}</small><strong>{value}</strong></div>;
}

const styles = `
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#07111e;color:#eef5ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ps-admin-login{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,#15385d 0,#07111e 42%,#030911 100%);padding:24px}.ps-login-card{width:min(480px,100%);background:rgba(11,26,43,.94);border:1px solid #284664;border-radius:20px;padding:42px;box-shadow:0 35px 90px #0008}.ps-logo{width:58px;height:58px;border:2px solid #cfe6ff;border-radius:50%;display:grid;place-items:center;font-weight:900;letter-spacing:-.08em}.ps-logo.small{width:38px;height:38px;font-size:12px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.18em;color:#73b4ff;margin:18px 0 10px}.ps-login-card h1,.hero-row h1{font-size:clamp(34px,5vw,58px);letter-spacing:-.045em;line-height:1;margin:0 0 16px}.muted{color:#8da0b5;line-height:1.6}.ps-login-card label{display:block;font-size:12px;font-weight:800;color:#b7c7d8;margin:20px 0}.ps-login-card input{display:block;width:100%;margin-top:8px;background:#06101d;border:1px solid #35516f;border-radius:9px;padding:13px;color:white}.ps-login-card button,.top-actions button,.row-actions button,.review-list button{border:0;border-radius:8px;background:#eaf4ff;color:#07111e;font-weight:900;padding:11px 15px;cursor:pointer}.ps-login-card>button{width:100%;margin-top:4px}.error,.notice{margin-top:18px;padding:12px 14px;border-radius:9px;background:#3a1820;border:1px solid #7c3140;color:#ffd9df}.ps-admin{min-height:100vh;background:radial-gradient(circle at 85% -10%,#12355a 0,transparent 30%),#07111e;padding-bottom:40px}.topbar{height:72px;padding:0 max(24px,calc((100vw - 1380px)/2));display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1a3047;background:#06101de8;position:sticky;top:0;z-index:20;backdrop-filter:blur(18px)}.brand{display:flex;align-items:center;gap:12px}.brand b{display:block;font-size:13px}.brand small{display:block;color:#72869b;font-size:10px;margin-top:3px}.top-actions{display:flex;gap:8px;align-items:center}.secondary{background:#0d2034!important;color:#d7eaff!important;border:1px solid #284967!important}.launch-pill{font-size:9px;font-weight:900;letter-spacing:.12em;border-radius:999px;padding:8px 10px}.launch-pill.ready{background:#0c372b;color:#8bf0c7}.launch-pill.blocked{background:#3e2815;color:#ffc981}.hero-row,.metrics,.grid,.panel.batches-panel,.notice,footer{width:min(1380px,calc(100% - 40px));margin-left:auto;margin-right:auto}.hero-row{padding:62px 0 34px;display:flex;align-items:end;justify-content:space-between;gap:40px}.hero-row p{max-width:680px}.target{border:1px solid #2a4b68;background:#0b1b2c;border-radius:14px;padding:20px 24px;min-width:190px}.target small,.target span{display:block;color:#71879e;font-size:9px;letter-spacing:.13em}.target strong{display:block;font-size:30px;letter-spacing:-.04em;margin:4px 0}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:18px}.metric{border:1px solid #203a54;background:#0b1a2a;border-radius:12px;padding:18px}.metric small{color:#7f93a8;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.metric strong{font-size:30px;display:block;margin-top:8px}.metric.good{border-color:#1f5a47}.metric.warn{border-color:#6d4a24}.metric.bad{border-color:#6a2a38}.grid{display:grid;gap:18px;margin-bottom:18px}.grid.two{grid-template-columns:1fr 1fr}.panel{border:1px solid #203a54;background:linear-gradient(145deg,#0b1b2c,#091624);border-radius:14px;padding:24px;box-shadow:0 18px 45px #0002}.panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:18px}.panel-head .eyebrow{margin-top:0}.panel h2{margin:0;font-size:22px;letter-spacing:-.025em}.dot{width:10px;height:10px;border-radius:50%;margin-top:6px}.dot.good{background:#55d6a5;box-shadow:0 0 15px #55d6a5}.dot.bad{background:#ff866f;box-shadow:0 0 15px #ff866f}.blockers{padding:0;margin:0;list-style:none}.blockers li{padding:10px 12px;margin:7px 0;background:#261923;border-left:3px solid #ff806d;border-radius:5px;font-size:12px;color:#eabac0}.blockers.external li{background:#172131;border-left-color:#608bb8;color:#aec0d3}.success{font-size:12px;color:#7ee0ba}.compact-list>div,.review-list>div{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:13px 0;border-bottom:1px solid #1b3045}.compact-list>div:last-child,.review-list>div:last-child{border-bottom:0}.compact-list b,.review-list b{font-size:12px}.compact-list small,.review-list small,td small{display:block;color:#71869c;font-size:9px;margin-top:4px}.compact-list>div>span:last-child{text-align:right}.batches-panel{margin-bottom:18px}.filters{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.filters button{background:#0a1725;color:#8195aa;border:1px solid #263e56;border-radius:999px;padding:6px 9px;font-size:8px;font-weight:800;cursor:pointer}.filters button.selected{background:#d8ecff;color:#07111e;border-color:#d8ecff}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1050px}th{text-align:left;color:#6f849a;font-size:9px;text-transform:uppercase;letter-spacing:.1em;padding:11px 10px;border-bottom:1px solid #294057}td{font-size:11px;padding:14px 10px;border-bottom:1px solid #172b3e;vertical-align:top}.status{display:inline-flex;padding:5px 7px;border-radius:999px;font-size:8px;font-weight:900;letter-spacing:.04em}.status.good{background:#123d31;color:#85e2bd}.status.warn{background:#44301c;color:#ffc877}.status.bad{background:#461f2a;color:#ff9dac}.status.neutral{background:#182a3c;color:#a9bed3}.row-actions{display:flex;gap:5px;flex-wrap:wrap}.row-actions button,.review-list button{padding:7px 9px;font-size:9px}.row-actions .danger{background:#542330;color:#ffd9df}.empty{padding:38px;color:#708398;text-align:center;font-size:12px}details{margin-top:16px;border-top:1px solid #1f354b;padding-top:12px}summary{cursor:pointer;color:#91a9c0;font-size:11px}footer{padding:20px 0;color:#526a82;font-size:9px;text-align:center}.notice{margin-top:0;margin-bottom:18px}
@media(max-width:980px){.metrics{grid-template-columns:repeat(2,1fr)}.grid.two{grid-template-columns:1fr}.hero-row{align-items:flex-start;flex-direction:column}.target{width:100%}.panel-head.responsive{flex-direction:column}.filters{justify-content:flex-start}.topbar{padding:0 14px}.launch-pill{display:none}}@media(max-width:560px){.hero-row,.metrics,.grid,.panel.batches-panel,.notice,footer{width:min(100% - 24px,1380px)}.metrics{grid-template-columns:1fr 1fr}.metric:last-child{grid-column:span 2}.topbar{height:64px}.brand small{display:none}.top-actions .secondary:first-of-type{display:none}.hero-row{padding-top:36px}.panel{padding:18px}.ps-login-card{padding:28px}}
`;
