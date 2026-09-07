import json, re

def build():
    # Load datasets
    raw = json.load(open('tracking-convo-doc/chat-full-2026-08-01.json'))
    msgs_raw = raw.get('messages', [])
    txns = json.load(open('tracking-convo-doc/transactions_curated.json'))

    # Clean messages
    def ns(s, ts):
        if s:
            if s == 'You' or s.startswith('You:') or s.startswith('You '): return 'You'
            if s == 'CA' or s.startswith('CA:') or s.startswith('CA '): return 'CA'
        if 'CA:' in ts or 'by CA:' in ts: return 'CA'
        if 'You:' in ts or 'by You:' in ts: return 'You'
        return 'Unknown'

    msgs = []
    for i, m in enumerate(msgs_raw):
        s = m.get('sender'); ts = m.get('timestamp',''); txt = m.get('text',''); imgs = m.get('images',[])
        msgs.append({'id': i+1, 'sender': ns(s,ts), 'timestamp': ts, 'text': txt, 'images': imgs})

    payload = {
        'exported_at': raw.get('exported_at',''),
        'total': len(msgs),
        'messages': msgs,
        'transactions': txns
    }
    js = json.dumps(payload, ensure_ascii=False)

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tracking Convo & Payments Visualizer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
:root{{
  --bg:#090e1a;
  --surface:#0f1729;
  --surface2:#151f33;
  --surface3:#1c2840;
  --border:#1e2d4a;
  --border2:#263652;
  --text:#e2e8f0;
  --text2:#94a3b8;
  --text3:#64748b;
  --indigo:#6366f1;
  --indigo2:#818cf8;
  --violet:#8b5cf6;
  --emerald:#10b981;
  --amber:#f59e0b;
  --rose:#f43f5e;
  --cyan:#06b6d4;
}}
html,body{{height:100%;overflow:hidden;font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);font-size:14px}}
::-webkit-scrollbar{{width:6px;height:6px}}
::-webkit-scrollbar-track{{background:var(--surface)}}
::-webkit-scrollbar-thumb{{background:var(--border2);border-radius:4px}}
::-webkit-scrollbar-thumb:hover{{background:#334155}}

/* Layout */
.app{{display:flex;flex-direction:column;height:100vh}}
.topbar{{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid var(--border);background:rgba(9,14,26,0.9);backdrop-filter:blur(16px);position:relative;z-index:30;flex-shrink:0}}
.logo{{display:flex;align-items:center;gap:10px}}
.logo-icon{{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#10b981);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}}
.logo-text h1{{font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;background:linear-gradient(90deg,#e2e8f0,#94a3b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap}}
.logo-text p{{font-size:11px;color:var(--text3);white-space:nowrap}}
.topbar-actions{{display:flex;align-items:center;gap:8px}}
.btn{{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .15s;white-space:nowrap}}
.btn-ghost{{background:var(--surface2);border-color:var(--border2);color:var(--text2)}}
.btn-ghost:hover{{background:var(--surface3);color:var(--text)}}
.btn-indigo{{background:var(--indigo);color:#fff;border-color:var(--indigo)}}
.btn-indigo:hover{{background:#4f46e5}}
.btn-emerald{{background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.3);color:var(--emerald)}}
.btn-emerald:hover{{background:rgba(16,185,129,0.2)}}
.badge{{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:var(--surface3);color:var(--text2)}}

/* Tabs */
.workspace{{display:flex;flex:1;overflow:hidden}}
.sidebar{{width:320px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;background:var(--surface)}}
.sidebar-section{{padding:14px 16px;border-bottom:1px solid var(--border)}}
.sidebar-label{{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}}
.search-wrap{{position:relative}}
.search-wrap input{{width:100%;padding:8px 32px 8px 32px;background:var(--bg);border:1px solid var(--border2);border-radius:10px;color:var(--text);font-size:13px;outline:none;transition:border-color .15s}}
.search-wrap input:focus{{border-color:var(--indigo)}}
.search-wrap input::placeholder{{color:var(--text3)}}
.search-icon{{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);pointer-events:none}}
.search-clear{{position:absolute;right:9px;top:50%;transform:translateY(-50%);color:var(--text3);cursor:pointer;background:none;border:none;display:none;padding:0}}
.search-clear:hover{{color:var(--text)}}
.search-meta{{display:flex;align-items:center;justify-content:space-between;margin-top:7px;font-size:11px;color:var(--text3)}}
.search-meta label{{display:flex;align-items:center;gap:5px;cursor:pointer}}
.search-meta input[type=checkbox]{{accent-color:var(--indigo)}}

/* Filter pills */
.filter-pills{{display:flex;gap:6px;flex-wrap:wrap}}
.pill{{font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;cursor:pointer;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);transition:all .15s}}
.pill:hover{{border-color:var(--border2);color:var(--text);background:var(--surface3)}}
.pill.active{{background:var(--indigo);border-color:var(--indigo);color:#fff}}

/* Tag filter chips */
.tag-chips{{display:flex;gap:6px;flex-wrap:wrap}}
.tag-chip{{font-size:11px;padding:4px 10px;border-radius:8px;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text2);transition:all .15s;font-weight:500}}
.tag-chip:hover{{color:var(--text);border-color:var(--indigo)}}
.tag-chip.active{{background:rgba(99,102,241,0.15);border-color:var(--indigo);color:var(--indigo2)}}

/* Jump controls */
.jump-row{{display:flex;gap:6px}}
.jump-row input{{flex:1;padding:6px 10px;background:var(--bg);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-size:12px;outline:none}}
.jump-row input:focus{{border-color:var(--indigo)}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}}
.sidebar-footer{{margin-top:auto;padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:11px;color:var(--text3)}}
.sidebar-footer span{{color:var(--emerald);font-weight:600}}

/* Main content area */
.main{{flex:1;display:flex;flex-direction:column;overflow:hidden}}

/* Tab bar */
.tab-bar{{display:flex;align-items:center;gap:2px;padding:8px 20px 0;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0}}
.tab{{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px 10px 0 0;font-size:13px;font-weight:600;cursor:pointer;color:var(--text3);border-bottom:2px solid transparent;transition:all .15s;position:relative;bottom:-1px;white-space:nowrap}}
.tab:hover{{color:var(--text2);background:var(--surface2)}}
.tab.active{{color:var(--text);border-bottom-color:var(--indigo);background:var(--bg)}}
.tab .tab-count{{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:var(--surface3);color:var(--text3)}}
.tab.active .tab-count{{background:rgba(99,102,241,0.2);color:var(--indigo2)}}

/* Tab panels */
.tab-panel{{flex:1;overflow:hidden;display:none;flex-direction:column}}
.tab-panel.active{{display:flex}}

/* Filter banner */
.filter-banner{{padding:8px 20px;background:rgba(99,102,241,0.07);border-bottom:1px solid rgba(99,102,241,0.15);display:none;align-items:center;justify-content:space-between;font-size:12px;color:#a5b4fc;flex-shrink:0}}
.filter-banner.show{{display:flex}}
.filter-banner-dot{{width:6px;height:6px;border-radius:50%;background:var(--indigo);animation:pulse 2s infinite}}
@keyframes pulse{{0%,100%{{opacity:1}}50%{{opacity:.4}}}}

/* Chat feed */
.chat-feed{{flex:1;overflow-y:auto;padding:20px}}
.msg-group{{display:flex;flex-direction:column;margin-bottom:14px}}
.msg-group.you{{align-items:flex-end}}
.msg-group.ca{{align-items:flex-start}}
.msg-meta{{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px;color:var(--text3)}}
.msg-avatar{{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0}}
.msg-avatar.you{{background:linear-gradient(135deg,var(--indigo),var(--violet));color:#fff}}
.msg-avatar.ca{{background:linear-gradient(135deg,#7c3aed,#4338ca);color:#fff}}
.msg-sender{{font-weight:600}}
.msg-sender.you{{color:var(--indigo2)}}
.msg-sender.ca{{color:#a78bfa}}
.msg-id{{font-family:'JetBrains Mono',monospace;color:var(--text3)}}
.bubble-wrap{{position:relative;max-width:72%}}
.bubble{{padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.55;word-break:break-word;white-space:pre-wrap;position:relative}}
.bubble.you{{background:var(--surface2);border:1px solid var(--border2)}}
.bubble.ca{{background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15)}}
.bubble a{{color:var(--indigo2);text-decoration:underline;word-break:break-all}}
.bubble mark{{background:#f59e0b;color:#000;padding:0 2px;border-radius:2px;font-weight:600}}
.msg-actions{{position:absolute;right:8px;top:-28px;display:none;align-items:center;gap:2px;background:var(--surface);border:1px solid var(--border2);border-radius:8px;padding:3px;box-shadow:0 4px 12px rgba(0,0,0,.4)}}
.bubble-wrap:hover .msg-actions{{display:flex}}
.msg-action-btn{{padding:3px 6px;border-radius:5px;background:none;border:none;cursor:pointer;font-size:12px;color:var(--text3);transition:all .1s}}
.msg-action-btn:hover{{background:var(--surface2);color:var(--text)}}
.msg-imgs{{margin-top:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px}}
.msg-img{{border-radius:10px;overflow:hidden;border:1px solid var(--border2);cursor:pointer;position:relative}}
.msg-img img{{width:100%;max-height:200px;object-fit:cover;display:block;transition:transform .2s}}
.msg-img:hover img{{transform:scale(1.03)}}
.no-msgs{{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text3);gap:10px}}
.no-msgs-icon{{font-size:48px}}

/* Pagination */
.pagination{{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0;font-size:12px;color:var(--text3)}}

/* TRANSACTIONS TAB */
.txn-panel{{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}}
.txn-stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}}
.stat-card{{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 16px}}
.stat-card .stat-val{{font-size:22px;font-weight:800;font-family:'Outfit',sans-serif;margin-bottom:2px}}
.stat-card .stat-lbl{{font-size:11px;color:var(--text3);font-weight:500}}
.stat-card.c-indigo .stat-val{{color:var(--indigo2)}}
.stat-card.c-emerald .stat-val{{color:var(--emerald)}}
.stat-card.c-amber .stat-val{{color:var(--amber)}}
.stat-card.c-rose .stat-val{{color:var(--rose)}}
.stat-card.c-violet .stat-val{{color:var(--violet)}}

.txn-filters{{display:flex;align-items:center;gap:8px;flex-wrap:wrap}}
.cat-pill{{font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;cursor:pointer;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);transition:all .15s}}
.cat-pill:hover{{color:var(--text);background:var(--surface3)}}
.cat-pill.active{{color:#fff}}
.cat-pill[data-cat="ALL"].active{{background:#4f46e5;border-color:#4f46e5}}
.cat-pill[data-cat="Transfer"].active{{background:rgba(16,185,129,.8);border-color:var(--emerald)}}
.cat-pill[data-cat="CC Due"].active{{background:rgba(245,158,11,.8);border-color:var(--amber)}}
.cat-pill[data-cat="Card Swipe"].active{{background:rgba(139,92,246,.8);border-color:var(--violet)}}
.cat-pill[data-cat="Loan"].active{{background:rgba(244,63,94,.8);border-color:var(--rose)}}
.cat-pill[data-cat="Subscription"].active{{background:rgba(6,182,212,.8);border-color:var(--cyan)}}

/* Transaction cards */
.txn-list{{display:flex;flex-direction:column;gap:10px}}
.txn-card{{background:var(--surface2);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:border-color .15s}}
.txn-card:hover{{border-color:var(--border2)}}
.txn-card-top{{display:flex;align-items:flex-start;gap:12px;padding:14px 16px}}
.txn-cat-icon{{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}}
.txn-main{{flex:1;min-width:0}}
.txn-desc{{font-weight:600;font-size:13px;margin-bottom:4px;line-height:1.4}}
.txn-amount{{font-size:15px;font-weight:800;font-family:'Outfit',sans-serif}}
.txn-meta{{display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap}}
.txn-meta-item{{font-size:11px;color:var(--text3);display:flex;align-items:center;gap:3px}}
.cat-badge{{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid}}
.cat-badge.Transfer{{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.3);color:var(--emerald)}}
.cat-badge.CC-Due{{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.3);color:var(--amber)}}
.cat-badge.Card-Swipe{{background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.3);color:var(--violet)}}
.cat-badge.Loan{{background:rgba(244,63,94,.12);border-color:rgba(244,63,94,.3);color:var(--rose)}}
.cat-badge.Subscription{{background:rgba(6,182,212,.12);border-color:rgba(6,182,212,.3);color:var(--cyan)}}
.cat-badge.Other{{background:rgba(100,116,139,.12);border-color:rgba(100,116,139,.3);color:var(--text3)}}

.txn-convo{{background:var(--bg);border-top:1px solid var(--border);padding:12px 16px;display:flex;align-items:flex-start;gap:10px}}
.txn-convo-bubble{{flex:1;background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:8px 12px;font-size:12px;line-height:1.6;color:var(--text2);font-style:italic;word-break:break-word;max-height:80px;overflow:hidden;position:relative}}
.txn-convo-bubble.expanded{{max-height:none}}
.txn-convo-bubble::after{{content:'';position:absolute;bottom:0;left:0;right:0;height:24px;background:linear-gradient(to bottom,transparent,var(--surface));pointer-events:none}}
.txn-convo-bubble.expanded::after{{display:none}}
.txn-actions{{display:flex;flex-direction:column;gap:6px;flex-shrink:0}}
.txn-btn{{font-size:11px;font-weight:600;padding:5px 10px;border-radius:7px;cursor:pointer;border:1px solid var(--border2);background:var(--surface2);color:var(--indigo2);white-space:nowrap;transition:all .15s}}
.txn-btn:hover{{background:var(--indigo);border-color:var(--indigo);color:#fff}}
.txn-btn.expand-btn{{color:var(--text3)}}
.txn-btn.expand-btn:hover{{color:var(--text)}}
.txn-img-preview{{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}}
.txn-img-thumb{{width:48px;height:48px;border-radius:6px;overflow:hidden;border:1px solid var(--border2);cursor:pointer;flex-shrink:0}}
.txn-img-thumb img{{width:100%;height:100%;object-fit:cover}}

/* Timeline stripe */
.txn-timeline-dot{{width:10px;height:10px;border-radius:50%;background:var(--indigo);flex-shrink:0;margin-top:4px;position:relative}}

/* Lightbox */
.lightbox{{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:100;display:none;align-items:center;justify-content:center;padding:20px}}
.lightbox.show{{display:flex}}
.lightbox-inner{{max-width:900px;width:100%;display:flex;flex-direction:column;align-items:center;gap:12px}}
.lightbox-inner img{{max-width:100%;max-height:80vh;object-fit:contain;border-radius:10px;border:1px solid var(--border2)}}
.lightbox-close{{position:fixed;top:16px;right:16px;width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1px solid var(--border2);color:var(--text);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}}

/* Toast */
.toast{{position:fixed;bottom:20px;right:20px;background:var(--indigo);color:#fff;font-size:12px;font-weight:600;padding:10px 16px;border-radius:10px;z-index:200;animation:fadeup .25s ease;pointer-events:none}}
@keyframes fadeup{{from{{opacity:0;transform:translateY(6px)}}to{{opacity:1;transform:translateY(0)}}}}

/* ANALYTICS TAB */
.analytics-panel{{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}}
.analytics-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}}
.kw-grid{{display:flex;flex-wrap:wrap;gap:8px}}
.kw-chip{{display:flex;align-items:center;gap:6px;padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text2);cursor:pointer;transition:all .15s;font-weight:500}}
.kw-chip:hover{{background:var(--indigo);border-color:var(--indigo);color:#fff}}
.kw-count{{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:var(--surface3);color:var(--text3)}}
.kw-chip:hover .kw-count{{background:rgba(255,255,255,.2);color:#fff}}
.bar-container{{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px}}
.bar-container h3{{font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:12px}}
.bar-track{{height:24px;background:var(--bg);border-radius:8px;overflow:hidden;display:flex}}
.bar-you{{background:linear-gradient(90deg,var(--indigo),var(--violet));height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .5s ease}}
.bar-ca{{background:linear-gradient(90deg,#7c3aed,#4338ca);height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .5s ease}}
</style>
</head>
<body>
<div class="app">

<!-- TOP BAR -->
<header class="topbar">
  <div class="logo">
    <div class="logo-icon">💬</div>
    <div class="logo-text">
      <h1>Tracking Convo & Payments</h1>
      <p id="topbar-sub">Loading...</p>
    </div>
  </div>
  <div class="topbar-actions">
    <button class="btn btn-ghost" id="btn-open-gallery">🖼️ Media <span class="badge" id="gallery-badge">42</span></button>
    <button class="btn btn-ghost" id="btn-export">⬇️ Export</button>
  </div>
</header>

<!-- WORKSPACE -->
<div class="workspace">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-label">Search</div>
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="search-input" type="text" placeholder="Search keywords…">
        <button class="search-clear" id="search-clear">✕</button>
      </div>
      <div class="search-meta">
        <span id="search-count">All messages</span>
        <label><input type="checkbox" id="search-case"> Case sensitive</label>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Sender</div>
      <div class="filter-pills">
        <div class="pill active" data-sender="ALL">All</div>
        <div class="pill" data-sender="You">You</div>
        <div class="pill" data-sender="CA">CA</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Quick Filters</div>
      <div class="tag-chips">
        <div class="tag-chip" data-tag="bayad|pay|swipe|transfer|10k|20k|80k|due|bill|ew|eastwest|bpi">💳 Payments</div>
        <div class="tag-chip" data-tag="EW|EastWest|BPI|UnionBank|credit">🏦 Cards</div>
        <div class="tag-chip" data-tag="gcash|padala|transfer|pasahan|send">💸 Transfers</div>
        <div class="tag-chip" data-tag="Claude|Cursor|GPT|AI|Supabase">🤖 AI & Dev</div>
        <div class="tag-chip" data-filter="has_images">🖼️ Has Images</div>
        <div class="tag-chip" data-filter="starred">⭐ Starred</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Jump to Message</div>
      <div class="jump-row">
        <input type="number" id="jump-input" placeholder="Msg #" min="1">
        <button class="btn btn-ghost" id="btn-jump">Jump</button>
      </div>
      <div class="grid2">
        <button class="btn btn-ghost" id="btn-top">⬆ Top</button>
        <button class="btn btn-ghost" id="btn-bottom">⬇ Bottom</button>
      </div>
    </div>

    <div class="sidebar-footer">
      <span id="exported-at">Exported: —</span>
      <span>Antigravity AI</span>
    </div>
  </aside>

  <!-- MAIN -->
  <div class="main">

    <!-- TAB BAR -->
    <div class="tab-bar">
      <div class="tab active" data-tab="chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Chat Log
        <span class="tab-count" id="tab-chat-count">3208</span>
      </div>
      <div class="tab" data-tab="transactions">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        Transactions
        <span class="tab-count" id="tab-txn-count">41</span>
      </div>
      <div class="tab" data-tab="analytics">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        Analytics
      </div>
    </div>

    <!-- CHAT TAB -->
    <div class="tab-panel active" id="panel-chat">
      <div class="filter-banner" id="filter-banner">
        <div style="display:flex;align-items:center;gap:8px"><div class="filter-banner-dot"></div><span id="filter-text">Active filter</span></div>
        <button class="btn btn-ghost" id="btn-reset" style="font-size:11px;padding:3px 8px">Reset</button>
      </div>
      <div class="chat-feed" id="chat-feed"></div>
      <div class="pagination">
        <span id="page-info">Page 1 of 33</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" id="btn-prev">← Prev</button>
          <button class="btn btn-ghost" id="btn-next">Next →</button>
        </div>
      </div>
    </div>

    <!-- TRANSACTIONS TAB -->
    <div class="tab-panel" id="panel-transactions">
      <div class="txn-panel" id="txn-panel">
        <!-- Stats -->
        <div class="txn-stats" id="txn-stats"></div>
        <!-- Category filters -->
        <div class="txn-filters" id="txn-filters">
          <span style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Filter:</span>
          <div class="cat-pill active" data-cat="ALL">All Transactions</div>
          <div class="cat-pill" data-cat="Transfer">💸 Transfers</div>
          <div class="cat-pill" data-cat="CC Due">📅 CC Dues</div>
          <div class="cat-pill" data-cat="Card Swipe">💳 Card Swipes</div>
          <div class="cat-pill" data-cat="Loan">🤝 Loans</div>
          <div class="cat-pill" data-cat="Subscription">🔧 Subscriptions</div>
        </div>
        <!-- Txn list -->
        <div class="txn-list" id="txn-list"></div>
        <p id="txn-empty" style="display:none;color:var(--text3);text-align:center;padding:40px">No transactions for this filter.</p>
      </div>
    </div>

    <!-- ANALYTICS TAB -->
    <div class="tab-panel" id="panel-analytics">
      <div class="analytics-panel">
        <div class="analytics-grid" id="analytics-stats"></div>
        <div class="bar-container">
          <h3>Message Share</h3>
          <div class="bar-track" id="bar-track"></div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--text3)">
            <span id="bar-you-lbl">You</span>
            <span id="bar-ca-lbl">CA</span>
          </div>
        </div>
        <div class="bar-container">
          <h3>Top Keywords (click to search)</h3>
          <div class="kw-grid" id="kw-grid"></div>
        </div>
      </div>
    </div>

  </div><!-- /.main -->
</div><!-- /.workspace -->
</div><!-- /.app -->

<!-- GALLERY MODAL -->
<div class="lightbox" id="gallery-modal">
  <button class="lightbox-close" id="close-gallery">✕</button>
  <div style="width:100%;max-width:1100px;display:flex;flex-direction:column;gap:16px">
    <h2 style="font-size:18px;font-weight:700;font-family:'Outfit',sans-serif;color:var(--text)">🖼️ Media Gallery <span id="gallery-count-lbl" style="font-size:13px;font-weight:400;color:var(--text3)"></span></h2>
    <div id="gallery-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;overflow-y:auto;max-height:70vh;padding:4px"></div>
  </div>
</div>

<!-- LIGHTBOX -->
<div class="lightbox" id="lightbox">
  <button class="lightbox-close" id="close-lightbox">✕</button>
  <div class="lightbox-inner">
    <img id="lightbox-img" src="" alt="">
    <button class="btn btn-indigo" id="lightbox-jump">Jump to message in Chat →</button>
  </div>
</div>

<!-- DATASET -->
<script id="dataset" type="application/json">
{js}
</script>

<script>
(function(){{
  // ── State ──
  let allMsgs = [], txns = [], filtered = [];
  let page = 1, pageSize = 100;
  let activeSender = 'ALL', searchQ = '', caseSensitive = false;
  let activeTag = null, activeFilter = null, activeCat = 'ALL';
  let starred = new Set(JSON.parse(localStorage.getItem('starred')||'[]'));
  let lightboxMsgId = null;

  // ── Boot ──
  function init() {{
    const data = JSON.parse(document.getElementById('dataset').textContent);
    allMsgs = data.messages || [];
    txns = data.transactions || [];

    const exp = data.exported_at ? new Date(data.exported_at).toLocaleDateString() : '—';
    document.getElementById('exported-at').textContent = 'Exported: '+exp;
    document.getElementById('topbar-sub').textContent = allMsgs.length.toLocaleString()+' messages';
    document.getElementById('tab-chat-count').textContent = allMsgs.length.toLocaleString();
    document.getElementById('tab-txn-count').textContent = txns.length;

    const imgCount = allMsgs.filter(m=>m.images&&m.images.length).length;
    document.getElementById('gallery-badge').textContent = imgCount;

    applyFilters();
    renderTransactions();
    renderAnalytics();
    wireEvents();
  }}

  // ── Filtering ──
  function applyFilters() {{
    filtered = allMsgs.filter(m => {{
      if (activeSender!=='ALL'&&m.sender!==activeSender) return false;
      if (activeFilter==='starred'&&!starred.has(m.id)) return false;
      if (activeFilter==='has_images'&&(!m.images||!m.images.length)) return false;
      if (activeTag) {{
        const r = new RegExp(activeTag,'i');
        if (!r.test(m.text)&&!r.test(m.timestamp)) return false;
      }}
      if (searchQ) {{
        const hay = m.text+' '+m.timestamp;
        const needle = caseSensitive ? searchQ : searchQ.toLowerCase();
        const h2 = caseSensitive ? hay : hay.toLowerCase();
        if (!h2.includes(needle)) return false;
      }}
      return true;
    }});
    page = 1;
    updateFilterBanner();
    renderPage();
    updateSearchCount();
  }}

  function updateFilterBanner() {{
    const parts = [];
    if (activeSender!=='ALL') parts.push('Sender: '+activeSender);
    if (searchQ) parts.push('Search: "'+searchQ+'"');
    if (activeTag) parts.push('Tag filter active');
    if (activeFilter==='starred') parts.push('Starred only');
    if (activeFilter==='has_images') parts.push('Has images');
    const banner = document.getElementById('filter-banner');
    if (parts.length) {{ banner.classList.add('show'); document.getElementById('filter-text').textContent = parts.join(' · '); }}
    else banner.classList.remove('show');
  }}

  function updateSearchCount() {{
    document.getElementById('search-count').textContent =
      filtered.length===allMsgs.length ? 'All '+allMsgs.length.toLocaleString()+' messages'
      : filtered.length.toLocaleString()+' of '+allMsgs.length.toLocaleString();
  }}

  // ── Chat Render ──
  function renderPage() {{
    const feed = document.getElementById('chat-feed');
    feed.innerHTML = '';
    const total = Math.ceil(filtered.length/pageSize)||1;
    if (page>total) page=total;
    const slice = filtered.slice((page-1)*pageSize, page*pageSize);

    if (!slice.length) {{
      feed.innerHTML = '<div class="no-msgs"><div class="no-msgs-icon">🔍</div><p>No messages found</p></div>';
    }} else {{
      slice.forEach(m => feed.appendChild(buildCard(m)));
    }}

    document.getElementById('page-info').textContent = 'Page '+page+' of '+total+' ('+filtered.length.toLocaleString()+' msgs)';
    document.getElementById('btn-prev').disabled = page<=1;
    document.getElementById('btn-next').disabled = page>=total;
    feed.scrollTop = 0;
  }}

  function buildCard(m) {{
    const isYou = m.sender==='You';
    const g = document.createElement('div');
    g.className = 'msg-group '+(isYou?'you':'ca');
    g.id = 'msg-'+m.id;

    let txt = esc(m.text);
    if (searchQ) {{
      const r = new RegExp('('+escRe(searchQ)+')',caseSensitive?'g':'gi');
      txt = txt.replace(r,'<mark>$1</mark>');
    }}
    txt = txt.replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank">$1</a>');

    let imgs = '';
    if (m.images&&m.images.length) {{
      imgs = '<div class="msg-imgs">'+m.images.map(u=>
        `<div class="msg-img" onclick="openLightbox('${{u}}',${{m.id}})"><img src="${{u}}" loading="lazy" alt="img"></div>`
      ).join('')+'</div>';
    }}

    const isStarred = starred.has(m.id);
    g.innerHTML = `
      <div class="msg-meta">
        <div class="msg-avatar ${{isYou?'you':'ca'}}">${{isYou?'Y':'CA'}}</div>
        <span class="msg-sender ${{isYou?'you':'ca'}}">${{m.sender}}</span>
        <span style="color:var(--text3)">·</span>
        <span style="font-size:10px">${{esc(m.timestamp)}}</span>
        <span class="msg-id">#${{m.id}}</span>
      </div>
      <div class="bubble-wrap">
        <div class="bubble ${{isYou?'you':'ca'}}">${{txt}}${{imgs}}</div>
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="toggleStar(${{m.id}})" title="Star">${{isStarred?'⭐':'☆'}}</button>
          <button class="msg-action-btn" onclick="copyMsg(${{m.id}})" title="Copy">📋</button>
          <button class="msg-action-btn" onclick="copyLink(${{m.id}})" title="Link">🔗</button>
        </div>
      </div>`;
    return g;
  }}

  // ── Transactions Render ──
  function renderTransactions() {{
    // Stats
    const cats = {{'Transfer':0,'CC Due':0,'Card Swipe':0,'Loan':0,'Subscription':0,'Other':0}};
    txns.forEach(t=>{{ const k=t.category in cats?t.category:'Other'; cats[k]++; }});
    const statCfg = [
      {{lbl:'Total Tracked',val:txns.length,cls:'c-indigo'}},
      {{lbl:'Transfers',val:cats['Transfer'],cls:'c-emerald'}},
      {{lbl:'CC Dues',val:cats['CC Due'],cls:'c-amber'}},
      {{lbl:'Card Swipes',val:cats['Card Swipe'],cls:'c-violet'}},
      {{lbl:'Loans',val:cats['Loan'],cls:'c-rose'}},
    ];
    const statsEl = document.getElementById('txn-stats');
    statsEl.innerHTML = statCfg.map(s=>`
      <div class="stat-card ${{s.cls}}">
        <div class="stat-val">${{s.val}}</div>
        <div class="stat-lbl">${{s.lbl}}</div>
      </div>`).join('');

    renderTxnList();
  }}

  function renderTxnList() {{
    const list = document.getElementById('txn-list');
    const empty = document.getElementById('txn-empty');
    const items = activeCat==='ALL' ? txns : txns.filter(t=>t.category===activeCat);

    if (!items.length) {{
      list.innerHTML=''; empty.style.display='block'; return;
    }}
    empty.style.display='none';

    const catIcons = {{'Transfer':'💸','CC Due':'📅','Card Swipe':'💳','Loan':'🤝','Subscription':'🔧','Other':'📝'}};
    const catColors = {{'Transfer':'rgba(16,185,129,.15)','CC Due':'rgba(245,158,11,.15)','Card Swipe':'rgba(139,92,246,.15)','Loan':'rgba(244,63,94,.15)','Subscription':'rgba(6,182,212,.15)','Other':'rgba(100,116,139,.15)'}};
    const amtColors = {{'Transfer':'var(--emerald)','CC Due':'var(--amber)','Card Swipe':'var(--violet)','Loan':'var(--rose)','Subscription':'var(--cyan)','Other':'var(--text2)'}};

    list.innerHTML = items.map((t,i) => {{
      const icon = catIcons[t.category]||'📝';
      const bg = catColors[t.category]||'rgba(100,116,139,.1)';
      const amtColor = amtColors[t.category]||'var(--text2)';
      const catClass = (t.category||'Other').replace(/ /g,'-');
      const snippet = esc(t.text).substring(0,300);
      const hasMore = t.text.length>300;
      const imgHtml = t.images&&t.images.length ? '<div class="txn-img-preview">'+t.images.map(u=>`<div class="txn-img-thumb" onclick="openLightbox('${{u}}',${{t.id}})"><img src="${{u}}" loading="lazy"></div>`).join('')+'</div>' : '';

      return `
        <div class="txn-card">
          <div class="txn-card-top">
            <div class="txn-cat-icon" style="background:${{bg}}">${{icon}}</div>
            <div class="txn-main">
              <div class="txn-desc">${{esc(t.description)}}</div>
              <div class="txn-amount" style="color:${{amtColor}}">${{esc(t.amounts)}}</div>
              <div class="txn-meta">
                <span class="cat-badge ${{catClass}}">${{t.category}}</span>
                <span class="txn-meta-item">👤 ${{esc(t.direction)}}</span>
                <span class="txn-meta-item">🕐 ${{esc(t.timestamp.substring(0,40))}}</span>
                <span class="txn-meta-item" style="font-family:monospace;color:var(--text3)">#${{t.id}}</span>
              </div>
            </div>
          </div>
          <div class="txn-convo">
            <div class="txn-convo-bubble" id="txn-bubble-${{t.id}}">"${{snippet}}${{hasMore?'…':''}}"</div>
            ${{imgHtml}}
            <div class="txn-actions">
              <button class="txn-btn" onclick="jumpToMsg(${{t.id}})">→ View in Chat</button>
              ${{hasMore?`<button class="txn-btn expand-btn" onclick="expandBubble(${{t.id}})">Show full</button>`:''}}</div>
          </div>
        </div>`;
    }}).join('');
  }}

  window.expandBubble = function(id) {{
    const el = document.getElementById('txn-bubble-'+id);
    if (el) {{
      el.classList.toggle('expanded');
      const t = txns.find(x=>x.id===id);
      if (t) el.innerHTML = '"'+esc(t.text)+'"';
    }}
  }};

  window.jumpToMsg = function(id) {{
    // Switch to chat tab
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    document.querySelector('.tab[data-tab="chat"]').classList.add('active');
    document.getElementById('panel-chat').classList.add('active');

    // Reset filters and jump
    activeSender='ALL'; searchQ=''; activeTag=null; activeFilter=null;
    document.getElementById('search-input').value='';
    document.getElementById('search-clear').style.display='none';
    document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
    document.querySelector('.pill[data-sender="ALL"]').classList.add('active');
    document.querySelectorAll('.tag-chip').forEach(c=>c.classList.remove('active'));
    applyFilters();

    // Jump
    const idx = filtered.findIndex(m=>m.id===id);
    if (idx!==-1) {{
      page = Math.floor(idx/pageSize)+1;
      renderPage();
      setTimeout(()=>{{
        const el = document.getElementById('msg-'+id);
        if (el) {{
          el.scrollIntoView({{behavior:'smooth',block:'center'}});
          el.style.outline='2px solid var(--indigo)';
          el.style.borderRadius='12px';
          setTimeout(()=>{{el.style.outline='';el.style.borderRadius=''}},2500);
        }}
      }},150);
    }}
  }};

  // ── Analytics Render ──
  function renderAnalytics() {{
    const you = allMsgs.filter(m=>m.sender==='You').length;
    const ca = allMsgs.filter(m=>m.sender==='CA').length;
    const imgs = allMsgs.filter(m=>m.images&&m.images.length).length;
    const total = allMsgs.length;

    const grid = document.getElementById('analytics-stats');
    grid.innerHTML = [
      {{lbl:'Total Messages',val:total.toLocaleString(),cls:'c-indigo'}},
      {{lbl:'You Messages',val:you.toLocaleString(),cls:'c-emerald'}},
      {{lbl:'CA Messages',val:ca.toLocaleString(),cls:'c-violet'}},
      {{lbl:'Images Shared',val:imgs,cls:'c-cyan'}},
      {{lbl:'Tracked Transactions',val:txns.length,cls:'c-amber'}},
    ].map(s=>`<div class="stat-card ${{s.cls}}"><div class="stat-val">${{s.val}}</div><div class="stat-lbl">${{s.lbl}}</div></div>`).join('');

    // Bar
    const yp = ((you/total)*100).toFixed(1), cp = ((ca/total)*100).toFixed(1);
    document.getElementById('bar-track').innerHTML =
      `<div class="bar-you" style="width:${{yp}}%">You</div><div class="bar-ca" style="width:${{cp}}%">CA</div>`;
    document.getElementById('bar-you-lbl').textContent = `You: ${{you.toLocaleString()}} (${{yp}}%)`;
    document.getElementById('bar-ca-lbl').textContent = `CA: ${{ca.toLocaleString()}} (${{cp}}%)`;

    // Keywords
    const kws = ['EW','EastWest','BPI','UnionBank','Claude','Cursor','Supabase','GitHub','Gym','Workout','Badminton','10k','20k','80k','Payout','GCash','MariBank','SPayLater','Maya','due','bill'];
    const grid2 = document.getElementById('kw-grid');
    grid2.innerHTML = kws.map(kw=>{{
      const cnt = allMsgs.filter(m=>new RegExp(kw,'i').test(m.text)).length;
      return `<div class="kw-chip" onclick="searchKw('${{kw}}')">${{kw}}<span class="kw-count">${{cnt}}</span></div>`;
    }}).join('');
  }}

  window.searchKw = function(kw) {{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    document.querySelector('.tab[data-tab="chat"]').classList.add('active');
    document.getElementById('panel-chat').classList.add('active');
    document.getElementById('search-input').value = kw;
    searchQ = kw;
    document.getElementById('search-clear').style.display='block';
    applyFilters();
  }};

  // ── Lightbox & Gallery ──
  window.openLightbox = function(url, msgId) {{
    lightboxMsgId = msgId;
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox').classList.add('show');
  }};

  function openGallery() {{
    const grid = document.getElementById('gallery-grid');
    const imgMsgs = allMsgs.filter(m=>m.images&&m.images.length);
    document.getElementById('gallery-count-lbl').textContent = '('+imgMsgs.length+' messages, '+imgMsgs.reduce((a,m)=>a+m.images.length,0)+' images)';
    grid.innerHTML = imgMsgs.flatMap(m=>m.images.map(u=>
      `<div style="aspect-ratio:1;border-radius:10px;overflow:hidden;border:1px solid var(--border);cursor:pointer;background:var(--surface2)" onclick="switchToLightbox('${{u}}',${{m.id}})">
         <img src="${{u}}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
       </div>`
    )).join('');
    document.getElementById('gallery-modal').classList.add('show');
  }}

  window.switchToLightbox = function(url, id) {{
    document.getElementById('gallery-modal').classList.remove('show');
    openLightbox(url, id);
  }};

  // ── Global Actions ──
  window.toggleStar = function(id) {{
    if (starred.has(id)) starred.delete(id); else starred.add(id);
    localStorage.setItem('starred', JSON.stringify([...starred]));
    applyFilters();
  }};
  window.copyMsg = function(id) {{
    const m = allMsgs.find(x=>x.id===id);
    if (m) {{ navigator.clipboard.writeText(m.text); toast('Copied!'); }}
  }};
  window.copyLink = function(id) {{
    navigator.clipboard.writeText(location.href+'#msg-'+id); toast('Link copied!');
  }};

  function toast(txt) {{
    const t=document.createElement('div'); t.className='toast'; t.textContent=txt;
    document.body.appendChild(t); setTimeout(()=>t.remove(),2200);
  }}

  function esc(s) {{
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }}
  function escRe(s) {{ return s.replace(/[.*+?^${{}}()|[\\]\\\\]/g,'\\\\$&'); }}

  // ── Event Wiring ──
  function wireEvents() {{
    // Search
    const si = document.getElementById('search-input');
    const sc = document.getElementById('search-clear');
    si.addEventListener('input',e=>{{ searchQ=e.target.value; sc.style.display=searchQ?'block':'none'; applyFilters(); }});
    sc.addEventListener('click',()=>{{ si.value=''; searchQ=''; sc.style.display='none'; applyFilters(); }});
    document.getElementById('search-case').addEventListener('change',e=>{{ caseSensitive=e.target.checked; applyFilters(); }});

    // Sender pills
    document.querySelectorAll('.pill').forEach(p=>p.addEventListener('click',e=>{{
      document.querySelectorAll('.pill').forEach(x=>x.classList.remove('active'));
      e.target.classList.add('active');
      activeSender = e.target.dataset.sender;
      applyFilters();
    }}));

    // Tag chips
    document.querySelectorAll('.tag-chip').forEach(c=>c.addEventListener('click',e=>{{
      const wasActive = e.target.classList.contains('active');
      document.querySelectorAll('.tag-chip').forEach(x=>x.classList.remove('active'));
      if (!wasActive) {{
        e.target.classList.add('active');
        activeTag = e.target.dataset.tag || null;
        activeFilter = e.target.dataset.filter || null;
      }} else {{
        activeTag = null; activeFilter = null;
      }}
      applyFilters();
    }}));

    // Reset
    document.getElementById('btn-reset').addEventListener('click',()=>{{
      activeSender='ALL'; searchQ=''; activeTag=null; activeFilter=null;
      document.getElementById('search-input').value='';
      document.getElementById('search-clear').style.display='none';
      document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
      document.querySelector('.pill[data-sender="ALL"]').classList.add('active');
      document.querySelectorAll('.tag-chip').forEach(c=>c.classList.remove('active'));
      applyFilters();
    }});

    // Pagination
    document.getElementById('btn-prev').addEventListener('click',()=>{{ if(page>1){{page--;renderPage();}} }});
    document.getElementById('btn-next').addEventListener('click',()=>{{
      const tot=Math.ceil(filtered.length/pageSize); if(page<tot){{page++;renderPage();}}
    }});
    document.getElementById('btn-top').addEventListener('click',()=>{{ page=1; renderPage(); }});
    document.getElementById('btn-bottom').addEventListener('click',()=>{{
      page=Math.ceil(filtered.length/pageSize)||1; renderPage();
    }});

    // Jump
    document.getElementById('btn-jump').addEventListener('click',()=>{{
      const v = parseInt(document.getElementById('jump-input').value);
      if (!v) return;
      const idx = filtered.findIndex(m=>m.id===v);
      if (idx!==-1) {{
        page = Math.floor(idx/pageSize)+1; renderPage();
        setTimeout(()=>{{
          const el=document.getElementById('msg-'+v);
          if(el){{ el.scrollIntoView({{behavior:'smooth',block:'center'}}); el.style.outline='2px solid var(--indigo)'; el.style.borderRadius='12px'; setTimeout(()=>{{el.style.outline='';el.style.borderRadius=''}},2500); }}
        }},150);
      }} else toast('Message #'+v+' not in current filter');
    }});

    // Tabs
    document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',e=>{{
      const name = e.currentTarget.dataset.tab;
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));
      e.currentTarget.classList.add('active');
      document.getElementById('panel-'+name).classList.add('active');
    }}));

    // Category filter in transactions
    document.querySelectorAll('.cat-pill').forEach(p=>p.addEventListener('click',e=>{{
      document.querySelectorAll('.cat-pill').forEach(x=>x.classList.remove('active'));
      e.target.classList.add('active');
      activeCat = e.target.dataset.cat;
      renderTxnList();
    }}));

    // Gallery & lightbox
    document.getElementById('btn-open-gallery').addEventListener('click', openGallery);
    document.getElementById('close-gallery').addEventListener('click',()=>document.getElementById('gallery-modal').classList.remove('show'));
    document.getElementById('close-lightbox').addEventListener('click',()=>document.getElementById('lightbox').classList.remove('show'));
    document.getElementById('lightbox-jump').addEventListener('click',()=>{{
      document.getElementById('lightbox').classList.remove('show');
      if (lightboxMsgId) jumpToMsg(lightboxMsgId);
    }});

    // Close modals on bg click
    ['gallery-modal','lightbox'].forEach(id=>{{
      document.getElementById(id).addEventListener('click',e=>{{
        if(e.target===e.currentTarget) e.target.classList.remove('show');
      }});
    }});

    // Export
    document.getElementById('btn-export').addEventListener('click',()=>{{
      const blob = new Blob([JSON.stringify(filtered,null,2)],{{type:'application/json'}});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download='convo-export-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
      toast('Exported '+filtered.length+' messages');
    }});
  }}

  document.addEventListener('DOMContentLoaded', init);
}})();
</script>
</body>
</html>'''

    with open('tracking-convo-doc/index.html','w',encoding='utf-8') as f:
        f.write(html)
    print(f'Done! {len(html)} bytes → tracking-convo-doc/index.html')

if __name__=='__main__':
    build()
