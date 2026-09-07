import json, re

raw = json.load(open('tracking-convo-doc/chat-full-2026-08-01.json'))
msgs = raw['messages']

def normalize_sender(s, ts):
    sender = None
    if s:
        if s == 'You' or s.startswith('You:') or s.startswith('You '):
            sender = 'You'
        elif s == 'CA' or s.startswith('CA:') or s.startswith('CA '):
            sender = 'CA'
    if not sender:
        if 'CA:' in ts or 'by CA:' in ts: sender = 'CA'
        elif 'You:' in ts or 'by You:' in ts: sender = 'You'
    return sender or 'Unknown'

# Curated transactions: (msg_id, category, direction, description, amounts)
curated = [
    (21,   'Subscription', 'CA',             "CA plans to upgrade Claude to Pro",                                        "$100/month"),
    (101,  'Transfer',     'CA → You',       "CA sends ₱450 to You",                                                    "₱450"),
    (464,  'Card Swipe',   'CA (Card)',       "CA swipes CC for BTS ticket (has ₱30k on hand)",                          "₱30,000"),
    (466,  'CC Due',       'You (EW)',        "You requests ₱10k from CA — EW due date June 11",                         "₱10,000"),
    (471,  'Transfer',     'You',            "You confirms ₱10k sent",                                                   "₱10,000"),
    (509,  'Transfer',     'You (GCash)',     "You to GCash total of ₱10,814 + ₱6k for all settlements",                 "₱10,814 + ₱6,000"),
    (516,  'Loan',         'CA → You (borrow)', "CA borrows ₱6k GCash from You, returns tomorrow",                      "₱6,000"),
    (544,  'Card Swipe',   'CA (Card)',       "CA swipes CC for V88 balance; amount < ₱10k",                             "<₱10,000"),
    (552,  'Transfer',     'CA → You',       "CA to send ₱10k + ₱6k on Friday",                                         "₱10,000 + ₱6,000"),
    (597,  'Loan',         'You → CA (borrow)', "You borrows ₱1k GCash from CA",                                        "₱1,000"),
    (608,  'Transfer',     'CA → You',       "CA sends ₱10k",                                                           "₱10,000"),
    (629,  'CC Due',       'CA (Card)',       "CA commits: min ₱20k payment; if phone sold → ₱40k",                     "₱20,000 – ₱40,000"),
    (634,  'CC Due',       'You (Card)',      "You settling credit card due on the 18th",                                 "Due May 18"),
    (642,  'CC Due',       'You (EW)',        "EastWest due June 1 — send payment by May 26 (3-day posting delay)",      "Due Jun 1 / Send by May 26"),
    (791,  'Transfer',     'CA → You',       "CA confirms ₱16k paid total",                                              "₱16,000"),
    (992,  'Transfer',     'CA',             "CA confirms ₱16k total paid (duplicate confirm)",                          "₱16,000"),
    (1283, 'Card Swipe',   'CA (Card)',       "CA requests straight ₱80k card swipe: 50% May 15, 50% on due date",       "₱80,000"),
    (1286, 'CC Due',       'CA (Card)',       "CA commits 50%/50% repayment split for ₱80k swipe",                       "₱40,000 × 2"),
    (1313, 'Loan',         'CA → You (return)', "CA returns ₱5k; will borrow ₱20k after CA is paid back",               "₱5,000 return / ₱20,000 borrow"),
    (1360, 'Transfer',     'CA → You',       "CA: return ₱5k, borrow ₱20k the next day if repaid",                     "₱5,000 / ₱20,000"),
    (1378, 'Transfer',     'You (SPayLater)', "You pays SPayLater now; ₱1k left in MariBank after",                     "₱1,000 remaining"),
    (1380, 'Transfer',     'You (EW→Maya)',   "Cash-in from EastWest to Maya — ₱300 fee per ₱10k",                      "₱300 fee / ₱10,000"),
    (1423, 'Transfer',     'CA → You',       "CA to send ₱7k today + ₱10k on Monday",                                   "₱7,000 + ₱10,000"),
    (1426, 'Transfer',     'CA → You',       "CA confirms sending ₱7k later",                                            "₱7,000"),
    (1551, 'CC Due',       'CA (Card)',       "CA surprised — only ₱4k bill this cycle; wonders how it wasn't cut",      "₱4,000"),
    (1641, 'Transfer',     'You → CA',       "You asks CA which account to send ₱10k to",                               "₱10,000"),
    (1699, 'Transfer',     'CA → You',       "CA sending ₱10k — requests QR code",                                      "₱10,000"),
    (1755, 'Card Swipe',   'CA (SPayLater)', "CA checking if item can be SPayLater'd — ₱1,700 total w/ shipping",       "₱1,700"),
    (1848, 'Transfer',     'You → CA',       "You sends ₱20k to CA",                                                    "₱20,000"),
    (1941, 'CC Due',       'You (Shopee)',    "You urges CA to pay back so You can settle ₱30k Shopee/SPayLater bill",  "₱30,000"),
    (2008, 'CC Due',       'CA (BPI)',        "CA confirms ₱30k BPI balance — will pay on the 30th",                    "₱30,000"),
    (2018, 'CC Due',       'You (BPI)',       "You missed BPI due date — incurred ₱1k past-due fee",                    "₱1,000 late fee"),
    (2021, 'CC Due',       'You (BPI)',       "BPI statement confirmed at ₱33k — no grace given",                       "₱33,000"),
    (2027, 'Card Swipe',   'You (SPayLater)', "You maxed ₱75k SPayLater credit; used 3-month installment for bills",   "₱75,000"),
    (2053, 'CC Due',       'CA (BPI)',        "BPI due was the 8th; CA forgot; ₱30k balance",                           "₱30,000"),
    (2171, 'Transfer',     'You → CA',       "₱5k not yet sent — suggests deducting from laptop balance",               "₱5,000"),
    (2247, 'CC Due',       'CA (Card)',       "CA's ₱50k CC charge ends December; January will be the payment month",   "₱50,000"),
    (2293, 'Transfer',     'CA',             "CA pays extra tonight to bring CC balance down to ₱30k by January",       "→ ₱30,000 remaining"),
    (2305, 'Transfer',     'CA',             "CA adds +₱5k payment",                                                    "₱5,000"),
    (2460, 'CC Due',       'You (Card)',      "You notes ₱20k still available; December statements delayed in posting",  "₱20,000"),
    (2612, 'CC Due',       'CA (CC)',         "CA asks You to total Nov CC swipes + current — estimated ~₱100k",         "~₱100,000"),
]

# Build result with actual message context
result = []
for item in curated:
    msg_id, cat, direction, desc, amounts = item
    m = msgs[msg_id - 1] if msg_id <= len(msgs) else None
    if m:
        ts = m.get('timestamp') or ''
        txt = m.get('text') or ''
        imgs = m.get('images') or []
        s = m.get('sender') or ''
        sender = normalize_sender(s, ts)
        result.append({
            'id': msg_id,
            'sender': sender,
            'timestamp': ts,
            'category': cat,
            'direction': direction,
            'description': desc,
            'amounts': amounts,
            'text': txt,
            'images': imgs
        })

with open('tracking-convo-doc/transactions_curated.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f'Saved {len(result)} curated transactions')
