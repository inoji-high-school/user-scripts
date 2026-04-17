// ==UserScript==
// @name         ノイミー盤 History Sheets
// @namespace    https://github.com/inoji-high-school/user-scripts
// @version      0.1.1
// @downloadURL  https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/chara-ani-sheets.user.js
// @updateURL    https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/chara-ani-sheets.user.js
// @description  Chara-Ani申込履歴を自動集計し、Google Sheets貼り付け用TSVを1クリックでコピーする
// @match        https://not-equal-me.chara-ani.com/*
// @match        http://not-equal-me.chara-ani.com/*
// @match        https://*.chara-ani.com/*
// @match        http://*.chara-ani.com/*
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==

(function attachCore(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.CharaAniSheetsCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCore() {
  const STATUS = Object.freeze({ WON: '当選', LOST: '落選', PENDING: '抽選待ち' });
  const ALLOWED_STATUSES = new Set(Object.values(STATUS));
  const IGNORED_STATUSES = new Set(['ｷｬﾝｾﾙ']);
  const REQUIRED_HEADERS = ['状態', '商品名', '申込数', '予定金額', '販売単価', '商品コード'];
  const RAW_COLUMNS = [
    'dedupe_key',
    'entry_no',
    'entry_label',
    'application_date',
    'status',
    'product_name',
    'quantity',
    'planned_amount_yen',
    'unit_price_yen',
    'product_code',
    'scraped_at'
  ];
  const SUMMARY_COLUMNS = ['status', 'product_name', 'quantity', 'planned_amount_yen', 'row_count'];

  function stripHtml(value) {
    return String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&yen;/g, '¥')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseJapaneseApplicationDate(text) {
    const match = cleanText(text).match(/申込日：\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!match) throw new Error(`申込日を解析できません: ${text}`);
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  function parseEntryLabel(text) {
    const match = cleanText(text).match(/【(\d+)件目】/);
    if (!match) throw new Error(`申込履歴番号を解析できません: ${text}`);
    return { entryNo: Number(match[1]), entryLabel: `【${match[1]}件目】` };
  }

  function parseCount(value) {
    const parsed = Number(String(value).replace(/[^0-9]/g, ''));
    if (!Number.isFinite(parsed)) throw new Error(`個数を解析できません: ${value}`);
    return parsed;
  }

  function parseYen(value) {
    const parsed = Number(String(value).replace(/[^0-9]/g, ''));
    if (!Number.isFinite(parsed)) throw new Error(`金額を解析できません: ${value}`);
    return parsed;
  }

  function validateStatus(status) {
    if (!ALLOWED_STATUSES.has(status)) {
      throw new Error(`未知の状態です: ${status}`);
    }
  }

  function toBaseKey(row) {
    return `${row.entry_no}|${row.application_date}|${row.product_name}`;
  }

  function toDedupeKey(row) {
    return `${toBaseKey(row)}|${row.status}`;
  }

  function rowFromCells(entry, cells, scrapedAt) {
    const [status, productName, quantity, plannedAmount, unitPrice, productCode] = cells.map(cleanText);
    if (IGNORED_STATUSES.has(status)) return null;
    validateStatus(status);
    const row = {
      entry_no: entry.entryNo,
      entry_label: entry.entryLabel,
      application_date: entry.applicationDate,
      status,
      product_name: productName,
      quantity: parseCount(quantity),
      planned_amount_yen: parseYen(plannedAmount),
      unit_price_yen: parseYen(unitPrice),
      product_code: productCode,
      scraped_at: scrapedAt
    };
    row.dedupe_key = toDedupeKey(row);
    return row;
  }

  function parseHistoryDocument(documentRef, options) {
    const scrapedAt = (options && options.scrapedAt) || new Date().toISOString();
    const blocks = Array.from(documentRef.querySelectorAll('.more-list-item, .c-history-table2-group'));
    const sourceBlocks = blocks.length > 0 ? blocks : Array.from(documentRef.querySelectorAll('h3.c-date-head')).map((h) => h.parentElement);
    const rows = [];
    const seenBlockElements = new Set();

    for (const block of sourceBlocks) {
      if (!block || seenBlockElements.has(block)) continue;
      seenBlockElements.add(block);
      const heading = block.querySelector('h3.c-date-head') || (block.matches && block.matches('h3.c-date-head') ? block : null);
      if (!heading) continue;
      const headingText = cleanText(heading.textContent);
      const entry = parseEntryLabel(headingText);
      entry.applicationDate = parseJapaneseApplicationDate(headingText);
      const table = block.querySelector('table.c-history-table2, table');
      if (!table) throw new Error(`${entry.entryLabel} の表が見つかりません`);
      const headers = Array.from(table.querySelectorAll('thead th')).map((cell) => cleanText(cell.textContent));
      ensureHeaders(headers, entry.entryLabel);
      for (const tr of Array.from(table.querySelectorAll('tbody tr'))) {
        const cells = Array.from(tr.querySelectorAll('td')).map((cell) => cleanText(cell.textContent));
        if (cells.length === 0) continue;
        if (cells.length < REQUIRED_HEADERS.length) throw new Error(`${entry.entryLabel} に欠損列があります`);
        const row = rowFromCells(entry, cells.slice(0, REQUIRED_HEADERS.length), scrapedAt);
        if (row) rows.push(row);
      }
    }
    return canonicalizeRows(rows);
  }

  function ensureHeaders(headers, context) {
    for (const required of REQUIRED_HEADERS) {
      if (!headers.includes(required)) throw new Error(`${context || '履歴表'} に必須列 ${required} がありません`);
    }
  }

  function parseHistoryHtml(html, options) {
    const scrapedAt = (options && options.scrapedAt) || new Date().toISOString();
    const rows = [];
    const headingPattern = /<h3\b[^>]*class=["'][^"']*c-date-head[^"']*["'][^>]*>[\s\S]*?<\/h3>/gi;
    const headings = [];
    let match;
    while ((match = headingPattern.exec(html))) {
      headings.push({ html: match[0], index: match.index, end: headingPattern.lastIndex });
    }
    for (let i = 0; i < headings.length; i += 1) {
      const headingText = stripHtml(headings[i].html);
      const entry = parseEntryLabel(headingText);
      entry.applicationDate = parseJapaneseApplicationDate(headingText);
      const blockHtml = html.slice(headings[i].end, i + 1 < headings.length ? headings[i + 1].index : html.length);
      const tableMatch = blockHtml.match(/<table\b[\s\S]*?<\/table>/i);
      if (!tableMatch) throw new Error(`${entry.entryLabel} の表が見つかりません`);
      const headerMatches = Array.from(tableMatch[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)).map((m) => stripHtml(m[1]));
      ensureHeaders(headerMatches, entry.entryLabel);
      const bodyMatch = tableMatch[0].match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i);
      const rowSource = bodyMatch ? bodyMatch[1] : tableMatch[0];
      for (const rowMatch of rowSource.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = Array.from(rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => stripHtml(m[1]));
        if (cells.length === 0) continue;
        if (cells.length < REQUIRED_HEADERS.length) throw new Error(`${entry.entryLabel} に欠損列があります`);
        const row = rowFromCells(entry, cells.slice(0, REQUIRED_HEADERS.length), scrapedAt);
        if (row) rows.push(row);
      }
    }
    return canonicalizeRows(rows);
  }

  function statusRank(status) {
    if (status === STATUS.WON) return 3;
    if (status === STATUS.LOST) return 3;
    if (status === STATUS.PENDING) return 1;
    return 0;
  }

  function stableFields(row) {
    return {
      entry_no: row.entry_no,
      entry_label: row.entry_label,
      application_date: row.application_date,
      product_name: row.product_name,
      quantity: row.quantity,
      planned_amount_yen: row.planned_amount_yen,
      unit_price_yen: row.unit_price_yen,
      product_code: row.product_code
    };
  }

  function sameStableFields(left, right) {
    return JSON.stringify(stableFields(left)) === JSON.stringify(stableFields(right));
  }

  function chooseCanonicalRow(existing, incoming, conflictSink) {
    validateStatus(existing.status);
    validateStatus(incoming.status);
    if (existing.status === incoming.status) {
      if (!sameStableFields(existing, incoming)) {
        conflictSink.push({ type: 'same-status-field-mismatch', existing, incoming });
        return existing;
      }
      return { ...existing, scraped_at: incoming.scraped_at || existing.scraped_at };
    }
    if (existing.status === STATUS.PENDING && statusRank(incoming.status) > statusRank(existing.status)) {
      return incoming;
    }
    if (incoming.status === STATUS.PENDING && statusRank(existing.status) > statusRank(incoming.status)) {
      conflictSink.push({ type: 'final-to-pending-downgrade', existing, incoming });
      return existing;
    }
    conflictSink.push({ type: 'final-status-conflict', existing, incoming });
    return existing;
  }

  function mergeRows(existingRows, incomingRows) {
    const conflicts = [];
    const stats = { added: 0, replaced_pending: 0, skipped_duplicate: 0, conflicts: 0 };
    const byKey = new Map();
    for (const row of existingRows || []) {
      validateRow(row);
      const canonicalKey = toDedupeKey(row);
      byKey.set(canonicalKey, { ...row, dedupe_key: canonicalKey });
    }
    for (const incoming of incomingRows || []) {
      validateRow(incoming);
      const row = { ...incoming, dedupe_key: toDedupeKey(incoming) };
      const existing = byKey.get(row.dedupe_key);
      if (row.status !== STATUS.PENDING) {
        const pendingKey = `${toBaseKey(row)}|${STATUS.PENDING}`;
        if (byKey.has(pendingKey)) {
          byKey.delete(pendingKey);
          stats.replaced_pending += 1;
        }
      }
      if (row.status === STATUS.PENDING) {
        const hasFinalForBase = Array.from(byKey.values()).some((existingRow) => {
          return toBaseKey(existingRow) === toBaseKey(row) && existingRow.status !== STATUS.PENDING;
        });
        if (hasFinalForBase) {
          conflicts.push({ type: 'final-to-pending-downgrade', existing: null, incoming: row });
          stats.conflicts += 1;
          continue;
        }
      }
      if (!existing) {
        byKey.set(row.dedupe_key, row);
        stats.added += 1;
        continue;
      }
      const beforeStatus = existing.status;
      const beforeConflictCount = conflicts.length;
      const chosen = chooseCanonicalRow(existing, row, conflicts);
      byKey.set(row.dedupe_key, chosen);
      if (conflicts.length > beforeConflictCount) {
        stats.conflicts += 1;
      } else if (beforeStatus === STATUS.PENDING && chosen.status !== STATUS.PENDING) {
        stats.replaced_pending += 1;
      } else {
        stats.skipped_duplicate += 1;
      }
    }
    return { rows: canonicalizeRows(Array.from(byKey.values())), stats, conflicts };
  }

  function validateRow(row) {
    validateStatus(row.status);
    if (!Number.isFinite(Number(row.entry_no))) throw new Error(`entry_no が不正です: ${row.entry_no}`);
    if (!row.application_date) throw new Error('application_date がありません');
    if (!row.product_name) throw new Error('product_name がありません');
    if (!Number.isFinite(Number(row.quantity))) throw new Error(`quantity が不正です: ${row.quantity}`);
    if (!Number.isFinite(Number(row.planned_amount_yen))) throw new Error(`planned_amount_yen が不正です: ${row.planned_amount_yen}`);
  }

  function eventSortKey(productName) {
    const match = String(productName).match(/^(\d{1,2})\/(\d{1,2})/);
    if (!match) return '99-99';
    return `${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }

  function canonicalizeRows(rows) {
    return (rows || []).slice().sort((a, b) => {
      const eventCompare = eventSortKey(a.product_name).localeCompare(eventSortKey(b.product_name));
      if (eventCompare) return eventCompare;
      const appCompare = String(a.application_date).localeCompare(String(b.application_date));
      if (appCompare) return appCompare;
      if (a.entry_no !== b.entry_no) return a.entry_no - b.entry_no;
      return String(a.product_name).localeCompare(String(b.product_name), 'ja');
    });
  }

  function aggregateRowsByStatusAndProduct(rows) {
    const byStatusProduct = new Map();
    for (const row of rows || []) {
      validateRow(row);
      const key = `${row.status}|${row.product_name}`;
      const current = byStatusProduct.get(key) || {
        status: row.status,
        product_name: row.product_name,
        quantity: 0,
        planned_amount_yen: 0,
        row_count: 0
      };
      current.quantity += Number(row.quantity);
      current.planned_amount_yen += Number(row.planned_amount_yen);
      current.row_count += 1;
      byStatusProduct.set(key, current);
    }
    return Array.from(byStatusProduct.values()).sort((a, b) => {
      const statusCompare = a.status.localeCompare(b.status, 'ja');
      if (statusCompare) return statusCompare;
      const eventCompare = eventSortKey(a.product_name).localeCompare(eventSortKey(b.product_name));
      if (eventCompare) return eventCompare;
      return a.product_name.localeCompare(b.product_name, 'ja');
    });
  }

  function totalsForRows(rows) {
    return (rows || []).reduce((acc, row) => {
      acc.rows += 1;
      acc.quantity += Number(row.quantity || 0);
      acc.planned_amount_yen += Number(row.planned_amount_yen || 0);
      return acc;
    }, { rows: 0, quantity: 0, planned_amount_yen: 0 });
  }

  function escapeTsv(value) {
    const text = String(value == null ? '' : value);
    if (!/[\t\n\r"]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function rowsToTsv(rows, columns) {
    const selectedColumns = columns || RAW_COLUMNS;
    const lines = [selectedColumns.join('\t')];
    for (const row of rows || []) {
      lines.push(selectedColumns.map((column) => escapeTsv(row[column])).join('\t'));
    }
    return `${lines.join('\n')}\n`;
  }

  function rowsToCsv(rows, columns) {
    const selectedColumns = columns || RAW_COLUMNS;
    const escapeCsv = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    const lines = [selectedColumns.map(escapeCsv).join(',')];
    for (const row of rows || []) {
      lines.push(selectedColumns.map((column) => escapeCsv(row[column])).join(','));
    }
    return `${lines.join('\n')}\n`;
  }

  function stableHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function hashRows(rows) {
    const normalized = canonicalizeRows(rows || []).map((row) => {
      const clone = { ...row };
      delete clone.scraped_at;
      return clone;
    });
    return stableHash(JSON.stringify(normalized));
  }

  return {
    STATUS,
    ALLOWED_STATUSES,
    RAW_COLUMNS,
    SUMMARY_COLUMNS,
    parseHistoryDocument,
    parseHistoryHtml,
    mergeRows,
    aggregateRowsByStatusAndProduct,
    totalsForRows,
    rowsToTsv,
    rowsToCsv,
    stableHash,
    hashRows,
    eventSortKey,
    canonicalizeRows,
    toBaseKey,
    toDedupeKey
  };
});


(function startCharaAniSheetsCopyOnlyUserScript() {
  const core = globalThis.CharaAniSheetsCore;

  function logBoot(message) {
    try { console.info('[Chara-Ani Sheets Sync]', message, location.href); } catch (_) {}
    try { document.documentElement.setAttribute('data-chara-ani-sheets-sync', message); } catch (_) {}
  }

  function readCurrentPageRows() {
    return core.parseHistoryDocument(document, { scrapedAt: new Date().toISOString() });
  }

  function outcomeOverview(rawRows) {
    return rawRows.reduce((overview, row) => {
      if (!overview[row.status]) {
        overview[row.status] = { row_count: 0, quantity: 0, amount_yen: 0 };
      }
      overview[row.status].row_count += 1;
      overview[row.status].quantity += Number(row.quantity || 0);
      overview[row.status].amount_yen += Number(row.planned_amount_yen || 0);
      if (row.status === core.STATUS.WON) {
        overview.paid_amount_yen += Number(row.planned_amount_yen || 0);
      }
      if (row.status === core.STATUS.PENDING) {
        overview.remaining_expected_amount_yen += Number(row.planned_amount_yen || 0);
      }
      return overview;
    }, {
      [core.STATUS.WON]: { row_count: 0, quantity: 0, amount_yen: 0 },
      [core.STATUS.LOST]: { row_count: 0, quantity: 0, amount_yen: 0 },
      [core.STATUS.PENDING]: { row_count: 0, quantity: 0, amount_yen: 0 },
      paid_amount_yen: 0,
      remaining_expected_amount_yen: 0
    });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('ja-JP');
  }

  function eventMonthFromProductName(productName) {
    const match = String(productName).match(/^(\d{1,2})\/(\d{1,2})/);
    if (!match) return '日付不明';
    return `${match[1].padStart(2, '0')}月`;
  }

  function eventMonthNumber(productName) {
    const match = String(productName).match(/^(\d{1,2})\/(\d{1,2})/);
    return match ? Number(match[1]) : 0;
  }

  function eventDayNumber(productName) {
    const match = String(productName).match(/^(\d{1,2})\/(\d{1,2})/);
    return match ? Number(match[2]) : 0;
  }

  function eventCyclicSortRank(productName, anchorMonthNumber) {
    const month = eventMonthNumber(productName);
    if (!month) return 999;
    return (anchorMonthNumber - month + 12) % 12;
  }

  function statusSortRank(status) {
    if (status === core.STATUS.PENDING) return 0;
    if (status === core.STATUS.WON) return 1;
    if (status === core.STATUS.LOST) return 2;
    return 9;
  }

  function applicationMonthFromDate(dateText) {
    const match = String(dateText).match(/^(\d{4})-(\d{2})-/);
    return match ? `${match[1]}-${match[2]}` : '申込月不明';
  }

  function eventYearFromEventDateLabel(dateLabel) {
    const match = String(dateLabel || '').match(/^(\d{4})-/);
    return match ? match[1] : '年不明';
  }

  function eventYearMonthFromEventDateLabel(dateLabel) {
    const match = String(dateLabel || '').match(/^(\d{4})-(\d{2})-/);
    return match ? `${match[1]}-${match[2]}` : '年月不明';
  }

  function aggregateRowsByGroupAndStatus(rawRows, groupName, groupValueOf) {
    const map = new Map();
    for (const row of rawRows) {
      const groupValue = groupValueOf(row);
      const key = `${groupName}|${groupValue}|${row.status}`;
      const current = map.get(key) || {
        group_name: groupName,
        group_value: groupValue,
        status: row.status,
        row_count: 0,
        quantity: 0,
        amount_yen: 0,
        paid_amount_yen: 0
      };
      current.row_count += 1;
      current.quantity += Number(row.quantity || 0);
      current.amount_yen += Number(row.planned_amount_yen || 0);
      if (row.status === core.STATUS.WON) {
        current.paid_amount_yen += Number(row.planned_amount_yen || 0);
      }
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => {
      return a.group_name.localeCompare(b.group_name, 'ja') ||
        a.group_value.localeCompare(b.group_value, 'ja') ||
        a.status.localeCompare(b.status, 'ja');
    });
  }

  function analysisRows(rawRows) {
    return [
      ...aggregateRowsByGroupAndStatus(rawRows, '全体', () => '全体'),
      ...aggregateRowsByGroupAndStatus(rawRows, '申込月', (row) => applicationMonthFromDate(row.application_date)),
      ...aggregateRowsByGroupAndStatus(rawRows, 'イベント月', (row) => eventMonthFromProductName(row.product_name))
    ];
  }

  function latestPendingOrFallbackMonthNumber(rawRows) {
    const pendingMonths = rawRows.filter((row) => row.status === core.STATUS.PENDING)
      .map((row) => eventMonthNumber(row.product_name))
      .filter(Boolean);
    const fallbackMonths = rawRows.map((row) => eventMonthNumber(row.product_name)).filter(Boolean);
    return Math.max(...(pendingMonths.length ? pendingMonths : fallbackMonths));
  }

  function eventDatePartsFromName(productName) {
    const match = String(productName).match(/^(\d{1,2})\/(\d{1,2})\(([^)]+)\)/);
    if (!match) return null;
    return { month: Number(match[1]), day: Number(match[2]), weekday: match[3] };
  }

  function dateFromParts(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day));
  }

  function isoDateText(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function applicationDateValue(row, fallbackYear) {
    const match = String(row.application_date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
    }
    return dateFromParts(fallbackYear, 1, 1);
  }

  function eventDateLabelFromRow(row, fallbackYear) {
    const parts = eventDatePartsFromName(row.product_name);
    if (!parts) return '';
    const applicationDate = applicationDateValue(row, fallbackYear);
    const baseYear = applicationDate.getUTCFullYear();
    const sameYearEventDate = dateFromParts(baseYear, parts.month, parts.day);
    const eventDate = sameYearEventDate >= applicationDate ? sameYearEventDate : dateFromParts(baseYear + 1, parts.month, parts.day);
    return `${isoDateText(eventDate)}(${parts.weekday})`;
  }

  function productNameWithoutEventDate(productName) {
    return String(productName).replace(/^\d{1,2}\/\d{1,2}\([^)]+\)\s*/, '');
  }

  function productKindFromName(productName) {
    const match = String(productName).match(/【([^】]+)】/);
    return match ? match[1] : '';
  }

  function summaryKindColumn(productName) {
    const kind = productKindFromName(productName);
    if (kind === '個別お話し会') return '個別お話し会';
    if (kind === 'ツーショット撮影会') return 'ツーショット撮影会';
    if (kind === '2S撮影会' || kind === '2S写真会') return '2S撮影会';
    if (kind === 'サイン会') return 'サイン会';
    return 'その他';
  }

  function eventDateLabelFromDetailRow(row) {
    return eventDateLabelFromRow(row, new Date().getFullYear());
  }

  function aggregateProductSummaryRows(rawRows) {
    const map = new Map();
    for (const row of rawRows) {
      const key = `${row.status}|${row.product_name}`;
      const current = map.get(key) || {
        status: row.status,
        product_name: row.product_name,
        event_date_label: eventDateLabelFromDetailRow(row),
        product_kind: productKindFromName(row.product_name),
        product_name_without_date: productNameWithoutEventDate(row.product_name),
        quantity: 0,
        planned_amount_yen: 0
      };
      current.quantity += Number(row.quantity || 0);
      current.planned_amount_yen += Number(row.planned_amount_yen || 0);
      if (!current.event_date_label) current.event_date_label = eventDateLabelFromDetailRow(row);
      map.set(key, current);
    }
    return Array.from(map.values());
  }

  function addWonSummaryAmount(summaryMap, groupName, groupValue, row) {
    const key = `${groupName}|${groupValue}`;
    const current = summaryMap.get(key) || {
      group_name: groupName,
      group_value: groupValue,
      paid_amount_yen: 0,
      '個別お話し会': 0,
      'ツーショット撮影会': 0,
      '2S撮影会': 0,
      'サイン会': 0,
      'その他': 0
    };
    current.paid_amount_yen += Number(row.planned_amount_yen || 0);
    current[summaryKindColumn(row.product_name)] += Number(row.quantity || 0);
    summaryMap.set(key, current);
  }

  function wonSummaryRowsForCopy(rawRows) {
    const summaryMap = new Map();
    for (const row of rawRows) {
      if (row.status !== core.STATUS.WON) continue;
      const eventDate = eventDateLabelFromDetailRow(row);
      addWonSummaryAmount(summaryMap, '全体', '全体', row);
      addWonSummaryAmount(summaryMap, '開催年', eventYearFromEventDateLabel(eventDate), row);
      addWonSummaryAmount(summaryMap, '開催年月', eventYearMonthFromEventDateLabel(eventDate), row);
    }
    const groupRank = (groupName) => {
      if (groupName === '全体') return 0;
      if (groupName === '開催年') return 1;
      if (groupName === '開催年月') return 2;
      return 9;
    };
    return Array.from(summaryMap.values()).sort((a, b) => {
      return groupRank(a.group_name) - groupRank(b.group_name) || b.group_value.localeCompare(a.group_value, 'ja');
    });
  }

  function wonSummaryTsvForCopy(rawRows) {
    const columns = [
      { key: 'group_name', label: '集計軸' },
      { key: 'group_value', label: '集計値' },
      { key: '個別お話し会', label: '個別お話し会' },
      { key: 'ツーショット撮影会', label: 'ツーショット撮影会' },
      { key: '2S撮影会', label: '2S撮影会' },
      { key: 'サイン会', label: 'サイン会' },
      { key: 'その他', label: 'その他' },
      { key: 'paid_amount_yen', label: '当選済金額' }
    ];
    const lines = [columns.map((column) => column.label).join('\t')];
    for (const row of wonSummaryRowsForCopy(rawRows)) {
      lines.push(columns.map((column) => String(row[column.key] ?? '')).join('\t'));
    }
    return `${lines.join('\n')}\n`;
  }

  function latestApplicationYear(rawRows) {
    const years = rawRows.map((row) => Number(String(row.application_date || '').slice(0, 4))).filter((year) => {
      return Number.isFinite(year) && year > 0;
    });
    return years.length ? Math.max(...years) : new Date().getFullYear();
  }

  function productSummaryForCopy(summaryRows, anchorMonthNumber) {
    return summaryRows.slice().sort((a, b) => {
      return statusSortRank(a.status) - statusSortRank(b.status) ||
        String(b.event_date_label || '').localeCompare(String(a.event_date_label || '')) ||
        a.product_name.localeCompare(b.product_name, 'ja');
    });
  }

  function combinedSheetTsv(summaryRows, anchorMonthNumber) {
    const columns = [
      { key: 'status', label: '状態' },
      { key: 'event_date_label', label: '日付' },
      { key: 'product_name_without_date', label: '商品名' },
      { key: 'product_kind', label: '種別' },
      { key: 'quantity', label: '申込数' },
      { key: 'planned_amount_yen', label: '予定金額' }
    ];
    const lines = [columns.map((column) => column.label).join('\t')];
    for (const row of productSummaryForCopy(summaryRows, anchorMonthNumber)) {
      const copyRow = {
        ...row,
        event_date_label: row.event_date_label,
        product_name_without_date: row.product_name_without_date,
        product_kind: row.product_kind
      };
      lines.push(columns.map((column) => String(copyRow[column.key] ?? '')).join('\t'));
    }
    return `${lines.join('\n')}\n`;
  }

  async function copyText(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return true;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  }

  function hrefWithPage1000() {
    const url = new URL(location.href);
    url.searchParams.set('page', '1000');
    return url.toString();
  }

  function isWithinTwelveMonthWindow(productName, anchorMonthNumber) {
    return eventCyclicSortRank(productName, anchorMonthNumber) < 12;
  }

  function productRowsForPanel(summaryRows, anchorMonthNumber) {
    return productSummaryForCopy(summaryRows, anchorMonthNumber).filter((row) => {
      return isWithinTwelveMonthWindow(row.product_name, anchorMonthNumber);
    });
  }

  function renderPanel(payload) {
    const existing = document.getElementById('chara-ani-sheets-panel');
    if (existing) existing.remove();

    const panel = document.createElement('section');
    panel.id = 'chara-ani-sheets-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:600px',
      'background:#fff',
      'color:#222',
      'border:1px solid #999',
      'border-radius:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,.2)',
      'font:13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
      'padding:12px'
    ].join(';');

    panel.innerHTML = [
      '<button type="button" data-close aria-label="閉じる">×</button>',
      `<div>当選済金額（全期間）  : ${formatNumber(payload.overview.paid_amount_yen)}円</div>`,
      `<div>残予定金額（抽選待ち）: ${formatNumber(payload.overview.remaining_expected_amount_yen)}円</div>`,
      '<div data-tabs style="display:inline-flex;margin-top:8px;border:1px solid #c8c8c8;border-radius:6px;overflow:hidden;background:#f6f6f6;white-space:nowrap">',
      '<button type="button" data-tab-monthly data-tab-button>月別</button>',
      '<button type="button" data-tab-products data-tab-button>商品別</button>',
      '</div>',
      '<div data-monthly-view><div style="margin-top:6px;font-weight:600">月別集計（12か月分）</div><div data-monthly></div></div>',
      '<div data-products-view style="display:none"><div style="margin-top:6px;font-weight:600">商品別集計（12か月分）</div><div data-products></div></div>',
      '<div data-actions style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px">',
      '<button type="button" data-copy-products>商品別集計をコピー</button>',
      '<button type="button" data-copy-summary>当選サマリーをコピー</button>',
      '</div>'
    ].join('');

    const closeButton = panel.querySelector('[data-close]');
    closeButton.style.cssText = [
      'position:absolute',
      'right:8px',
      'top:6px',
      'width:24px',
      'height:24px',
      'border:none',
      'background:transparent',
      'font-size:18px',
      'line-height:24px',
      'cursor:pointer'
    ].join(';');
    closeButton.addEventListener('click', () => panel.remove());
    for (const button of panel.querySelectorAll('button:not([data-close]):not([data-tab-button])')) {
      button.style.cssText = [
        'width:auto',
        'padding:6px 10px',
        'border:1px solid #dadce0',
        'border-radius:4px',
        'background:#f8f9fa',
        'color:#202124',
        'font-size:12px',
        'white-space:nowrap',
        'font-weight:500',
        'cursor:pointer',
        'text-decoration:none'
      ].join(';');
      button.addEventListener('mouseenter', () => { button.style.background = '#f1f3f4'; });
      button.addEventListener('mouseleave', () => { button.style.background = '#f8f9fa'; });
    }
    for (const button of panel.querySelectorAll('[data-tab-button]')) {
      button.style.cssText = [
        'min-width:72px',
        'padding:4px 12px',
        'border:none',
        'border-right:1px solid #c8c8c8',
        'background:transparent',
        'color:#333',
        'font-size:12px',
        'cursor:pointer',
        'text-decoration:none'
      ].join(';');
    }
    const lastTabButton = panel.querySelector('[data-tab-products]');
    lastTabButton.style.borderRight = 'none';

    const monthly = panel.querySelector('[data-monthly]');
    monthly.style.cssText = 'margin-top:6px;overflow-x:auto';
    const monthlyAmounts = new Map();
    for (const row of payload.rawRows) {
      const month = eventMonthFromProductName(row.product_name);
      const current = monthlyAmounts.get(month) || {
        remaining_quantity: 0,
        won_quantity: 0,
        remaining_amount: 0,
        paid_amount: 0
      };
      if (row.status === core.STATUS.PENDING) {
        current.remaining_quantity += Number(row.quantity || 0);
        current.remaining_amount += Number(row.planned_amount_yen || 0);
      }
      if (row.status === core.STATUS.WON) {
        current.won_quantity += Number(row.quantity || 0);
        current.paid_amount += Number(row.planned_amount_yen || 0);
      }
      monthlyAmounts.set(month, current);
    }
    const latestMonthNumber = latestPendingOrFallbackMonthNumber(payload.rawRows);
    const monthRowsHtml = Array.from({ length: 12 }, (_, index) => {
      const monthNumber = ((latestMonthNumber - index - 1 + 12) % 12) + 1;
      const month = `${String(monthNumber).padStart(2, '0')}月`;
      const amounts = monthlyAmounts.get(month) || {
        remaining_quantity: 0,
        won_quantity: 0,
        remaining_amount: 0,
        paid_amount: 0
      };
      return [
        '<tr>',
        `<th>${month}</th>`,
        `<td>${formatNumber(amounts.remaining_quantity)}</td>`,
        `<td>${formatNumber(amounts.won_quantity)}</td>`,
        `<td>${formatNumber(amounts.paid_amount)}円</td>`,
        `<td>${formatNumber(amounts.remaining_amount)}円</td>`,
        `<td>${formatNumber(amounts.paid_amount + amounts.remaining_amount)}円</td>`,
        '</tr>'
      ].join('');
    }).join('');
    monthly.innerHTML = [
      '<table style="width:100%;border-collapse:collapse;font-size:11px">',
      '<thead><tr><th>月</th><th>抽選待ち</th><th>当選</th><th>当選済金額</th><th>残予定金額</th><th>合計予定金額</th></tr></thead>',
      `<tbody>${monthRowsHtml}</tbody>`,
      '</table>'
    ].join('');
    for (const cell of monthly.querySelectorAll('th,td')) {
      cell.style.cssText = 'border:1px solid #ddd;padding:2px 4px;text-align:right;white-space:nowrap';
    }
    for (const cell of monthly.querySelectorAll('thead th')) {
      cell.style.background = '#eef3f8';
      cell.style.color = '#1f2933';
      cell.style.fontWeight = '700';
    }
    for (const row of monthly.querySelectorAll('tbody tr:nth-child(even)')) {
      row.style.background = '#fafafa';
    }

    const products = panel.querySelector('[data-products]');
    const productRows = productRowsForPanel(payload.summaryRows, latestMonthNumber);
    products.style.cssText = 'margin-top:6px;max-height:520px;overflow:auto';
    products.innerHTML = [
      '<table style="width:100%;border-collapse:collapse;font-size:11px">',
      '<thead><tr><th>状態</th><th>日付</th><th>商品名</th><th>種別</th><th>申込数</th><th>予定金額</th></tr></thead>',
      `<tbody>${productRows.map((row) => {
        const copyRow = {
          event_date_label: row.event_date_label,
          product_name_without_date: row.product_name_without_date,
          product_kind: row.product_kind,
          status: row.status,
          quantity: row.quantity,
          planned_amount_yen: row.planned_amount_yen
        };
        return [
          '<tr>',
          `<td>${copyRow.status}</td>`,
          `<td>${copyRow.event_date_label}</td>`,
          `<td style="text-align:left">${copyRow.product_name_without_date}</td>`,
          `<td>${copyRow.product_kind}</td>`,
          `<td>${formatNumber(copyRow.quantity)}</td>`,
          `<td>${formatNumber(copyRow.planned_amount_yen)}円</td>`,
          '</tr>'
        ].join('');
      }).join('')}</tbody>`,
      '</table>'
    ].join('');
    for (const cell of products.querySelectorAll('th,td')) {
      cell.style.cssText = 'border:1px solid #ddd;padding:2px 4px;text-align:right;white-space:nowrap';
    }
    for (const cell of products.querySelectorAll('thead th')) {
      cell.style.background = '#eef3f8';
      cell.style.color = '#1f2933';
      cell.style.fontWeight = '700';
    }
    for (const row of products.querySelectorAll('tbody tr:nth-child(even)')) {
      row.style.background = '#fafafa';
    }

    const monthlyView = panel.querySelector('[data-monthly-view]');
    const productsView = panel.querySelector('[data-products-view]');
    const monthlyTab = panel.querySelector('[data-tab-monthly]');
    const productsTab = panel.querySelector('[data-tab-products]');
    const setActiveTab = (active) => {
      const showProducts = active === 'products';
      monthlyView.style.display = showProducts ? 'none' : '';
      productsView.style.display = showProducts ? '' : 'none';
      panel.style.width = showProducts ? '1040px' : '600px';
      panel.style.maxHeight = showProducts ? '82vh' : '';
      panel.style.overflow = showProducts ? 'auto' : '';
      monthlyTab.style.background = showProducts ? 'transparent' : '#fff';
      productsTab.style.background = showProducts ? '#fff' : 'transparent';
      monthlyTab.style.fontWeight = showProducts ? '400' : '700';
      productsTab.style.fontWeight = showProducts ? '700' : '400';
    };
    monthlyTab.addEventListener('click', () => setActiveTab('monthly'));
    productsTab.addEventListener('click', () => setActiveTab('products'));
    setActiveTab('monthly');

    panel.querySelector('[data-copy-products]').addEventListener('click', async () => {
      try {
        await copyText(payload.productSummaryTsv);
      } catch (error) {
        window.alert(`コピー失敗: ${error.message || error}`);
      }
    });
    panel.querySelector('[data-copy-summary]').addEventListener('click', async () => {
      try {
        await copyText(payload.wonSummaryTsv);
      } catch (error) {
        window.alert(`コピー失敗: ${error.message || error}`);
      }
    });
    document.body.appendChild(panel);
  }

  function renderNavigatePanel() {
    const existing = document.getElementById('chara-ani-sheets-panel');
    if (existing) existing.remove();
    const panel = document.createElement('section');
    panel.id = 'chara-ani-sheets-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:260px',
      'background:#fff',
      'color:#222',
      'border:1px solid #999',
      'border-radius:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,.2)',
      'font:13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
      'padding:12px'
    ].join(';');
    panel.innerHTML = [
      '<button type="button" data-close aria-label="閉じる">×</button>',
      '<div>履歴ページで集計できます</div>',
      '<button type="button" data-open>履歴を開いて集計</button>'
    ].join('');
    const closeButton = panel.querySelector('[data-close]');
    closeButton.style.cssText = [
      'position:absolute',
      'right:8px',
      'top:6px',
      'width:24px',
      'height:24px',
      'border:none',
      'background:transparent',
      'font-size:18px',
      'line-height:24px',
      'cursor:pointer'
    ].join(';');
    closeButton.addEventListener('click', () => panel.remove());
    const openButton = panel.querySelector('[data-open]');
    openButton.style.cssText = [
      'width:100%',
      'margin-top:8px',
      'padding:8px',
      'border:1px solid #999',
      'border-radius:6px',
      'background:#e9e9e9',
      'color:#222',
      'cursor:pointer'
    ].join(';');
    openButton.addEventListener('mouseenter', () => { openButton.style.background = '#e9e9e9'; });
    openButton.addEventListener('mouseleave', () => { openButton.style.background = '#e9e9e9'; });
    openButton.addEventListener('click', () => {
      location.href = 'https://not-equal-me.chara-ani.com/akb_history.aspx?page=1000';
    });
    document.body.appendChild(panel);
  }

  function renderErrorPanel(error) {
    const panel = document.createElement('section');
    panel.id = 'chara-ani-sheets-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:320px',
      'background:#fff0f0',
      'color:#222',
      'border:1px solid #d99',
      'border-radius:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,.2)',
      'font:13px/1.5 system-ui,sans-serif',
      'padding:12px'
    ].join(';');
    panel.innerHTML = `<button type="button" data-close aria-label="閉じる">×</button><div>集計失敗: ${error.message || error}</div>`;
    const closeButton = panel.querySelector('[data-close]');
    closeButton.style.cssText = [
      'position:absolute',
      'right:8px',
      'top:6px',
      'width:24px',
      'height:24px',
      'border:none',
      'background:transparent',
      'font-size:18px',
      'line-height:24px',
      'cursor:pointer'
    ].join(';');
    closeButton.addEventListener('click', () => panel.remove());
    document.body.appendChild(panel);
  }

  function waitForHistoryRows(timeoutMs = 10000) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        const rowCount = document.querySelectorAll('.more-list-item tbody tr, .c-history-table2-group tbody tr').length;
        if (rowCount > 0) {
          resolve(rowCount);
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('履歴表の行が見つかりませんでした'));
          return;
        }
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  function startWhenDocumentIsReady(callback) {
    if (document.body) {
      callback();
      return;
    }
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  }

  logBoot('userscript loaded');
  startWhenDocumentIsReady(async () => {
    logBoot('document ready');
    if (!/not-equal-me\.chara-ani\.com/.test(location.hostname)) return;
    if (!/akb_history\.aspx/i.test(location.pathname)) {
      renderNavigatePanel();
      return;
    }
    if (new URL(location.href).searchParams.get('page') !== '1000') {
      location.replace(hrefWithPage1000());
      return;
    }
    try {
      await waitForHistoryRows();
      const rawRows = readCurrentPageRows();
      const mergeResult = core.mergeRows([], rawRows);
      if (mergeResult.conflicts.length > 0) {
        throw new Error(`merge conflict: ${mergeResult.conflicts.length}件`);
      }
      const summaryRows = aggregateProductSummaryRows(mergeResult.rows);
      const overview = outcomeOverview(mergeResult.rows);
      const analysis = analysisRows(mergeResult.rows);
      const latestMonthNumber = latestPendingOrFallbackMonthNumber(mergeResult.rows);
      const productSummaryTsv = combinedSheetTsv(summaryRows, latestMonthNumber);
      const wonSummaryTsv = wonSummaryTsvForCopy(mergeResult.rows);
      renderPanel({
        rawRows: mergeResult.rows,
        summaryRows,
        productSummaryTsv,
        wonSummaryTsv,
        overview,
        analysis
      });
    } catch (error) {
      renderErrorPanel(error);
    }
  });
})();
