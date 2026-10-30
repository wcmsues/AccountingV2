/* =========================================================
   小账本 · 数据层
   单键 acct_v2：默认值 / 读写 / 校验 / 迁移 / 导入导出
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;
  var KEY = 'acct_v2';
  var BAK = 'acct_v2_backup';       // 迁移前 / 导入前快照
  var PRE = 'acct_v2_preimport';    // 导入前的旧数据（可手动恢复）

  var S = {
    state: null,
    storageOk: true,
    flags: { memory: false, restored: false, versionHigh: false, quota: false, badData: false }
  };

  function int(v, d) {
    var n = Math.round(Number(v));
    return isFinite(n) ? n : d;
  }

  function defaultState() {
    var now = U.nowIso();
    return {
      version: 2,
      meta: { createdAt: now, updatedAt: now, lastAutoPostYm: '', lastBackupAt: '', demo: false },
      settings: { startBalance: 0, monthlyBudget: 0, autoPostFixed: 'due' },
      records: [],
      fixedItems: [],
      savings: [],
      goal: null,
      goalHistory: [],
      suppressedFixed: {}
    };
  }

  /* ---------- 归一化 / 迁移 ---------- */
  function normalize(raw) {
    var s = defaultState();
    if (!raw || typeof raw !== 'object') return s;

    var meta = raw.meta || {};
    if (typeof meta.createdAt === 'string') s.meta.createdAt = meta.createdAt;
    if (typeof meta.updatedAt === 'string') s.meta.updatedAt = meta.updatedAt;
    if (typeof meta.lastAutoPostYm === 'string') s.meta.lastAutoPostYm = meta.lastAutoPostYm;
    if (typeof meta.lastBackupAt === 'string') s.meta.lastBackupAt = meta.lastBackupAt;
    s.meta.demo = !!meta.demo;

    var set = raw.settings || {};
    s.settings.startBalance = int(set.startBalance, 0);
    s.settings.monthlyBudget = Math.max(0, int(set.monthlyBudget, 0));
    s.settings.autoPostFixed = ['due', 'monthStart', 'off'].indexOf(set.autoPostFixed) >= 0
      ? set.autoPostFixed : 'due';

    var seen = {};
    (Array.isArray(raw.records) ? raw.records : []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var type = r.type === 'income' ? 'income' : 'expense';
      var amount = int(r.amount, 0);
      if (amount <= 0) return;
      var id = (typeof r.id === 'string' && r.id) ? r.id : U.uid('r');
      if (seen[id]) id = U.uid('r');
      seen[id] = 1;
      var created = typeof r.createdAt === 'string' ? r.createdAt : U.nowIso();
      s.records.push({
        id: id,
        type: type,
        amount: amount,
        categoryId: typeof r.categoryId === 'string' ? r.categoryId : U.cat(type).id,
        date: U.isDate(r.date) ? r.date : U.todayStr(),
        note: typeof r.note === 'string' ? r.note.slice(0, 80) : '',
        source: r.source === 'fixed' ? 'fixed' : 'manual',
        fixedId: typeof r.fixedId === 'string' ? r.fixedId : null,
        createdAt: created,
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : created
      });
    });

    (Array.isArray(raw.fixedItems) ? raw.fixedItems : []).forEach(function (f) {
      if (!f || typeof f !== 'object') return;
      var type = f.type === 'income' ? 'income' : 'expense';
      var amount = int(f.amount, 0);
      var name = String(f.name == null ? '' : f.name).trim();
      if (!name || amount <= 0) return;
      s.fixedItems.push({
        id: (typeof f.id === 'string' && f.id) ? f.id : U.uid('fx'),
        type: type,
        name: name.slice(0, 20),
        amount: amount,
        categoryId: typeof f.categoryId === 'string' ? f.categoryId : U.cat(type).id,
        day: U.clamp(int(f.day, 1), 1, 31),
        enabled: f.enabled !== false,
        startMonth: U.isYm(f.startMonth) ? f.startMonth : U.currentYm(),
        endMonth: U.isYm(f.endMonth) ? f.endMonth : null
      });
    });

    (Array.isArray(raw.savings) ? raw.savings : []).forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var amount = int(x.amount, 0);
      if (amount <= 0) return;
      s.savings.push({
        id: (typeof x.id === 'string' && x.id) ? x.id : U.uid('sv'),
        type: x.type === 'out' ? 'out' : 'in',
        amount: amount,
        date: U.isDate(x.date) ? x.date : U.todayStr(),
        note: typeof x.note === 'string' ? x.note.slice(0, 40) : '',
        createdAt: typeof x.createdAt === 'string' ? x.createdAt : U.nowIso()
      });
    });

    if (raw.goal && typeof raw.goal === 'object') {
      var g = raw.goal;
      var target = int(g.targetAmount, 0);
      if (target > 0) {
        s.goal = {
          id: (typeof g.id === 'string' && g.id) ? g.id : U.uid('g'),
          name: String(g.name || '存钱目标').slice(0, 20),
          targetAmount: target,
          baseline: Math.max(0, int(g.baseline, 0)),
          deadline: U.isDate(g.deadline) ? g.deadline : null,
          status: g.status === 'achieved' ? 'achieved' : 'active',
          achievedAt: typeof g.achievedAt === 'string' ? g.achievedAt : null,
          createdAt: typeof g.createdAt === 'string' ? g.createdAt : U.nowIso()
        };
      }
    }

    (Array.isArray(raw.goalHistory) ? raw.goalHistory : []).forEach(function (h) {
      if (!h || typeof h !== 'object') return;
      var target = int(h.targetAmount, 0);
      if (target <= 0) return;
      s.goalHistory.push({
        id: typeof h.id === 'string' ? h.id : U.uid('gh'),
        name: String(h.name || '存钱目标').slice(0, 20),
        targetAmount: target,
        baseline: Math.max(0, int(h.baseline, 0)),
        status: h.status === 'achieved' ? 'achieved' : 'active',
        achievedAt: typeof h.achievedAt === 'string' ? h.achievedAt : null,
        archivedAt: typeof h.archivedAt === 'string' ? h.archivedAt : U.nowIso()
      });
    });

    if (raw.suppressedFixed && typeof raw.suppressedFixed === 'object') {
      Object.keys(raw.suppressedFixed).forEach(function (k) {
        var v = Number(raw.suppressedFixed[k]);
        if (/^[^@]+@\d{4}-\d{2}$/.test(k) && isFinite(v)) s.suppressedFixed[k] = v;
      });
    }

    return s;
  }

  /* ---------- 存储 ---------- */
  function probe() {
    try {
      var k = '__acct_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  function load() {
    S.storageOk = probe();
    S.flags.memory = !S.storageOk;

    var parsed = null;
    var raw = null;

    if (S.storageOk) {
      var text = null;
      try { text = localStorage.getItem(KEY); } catch (e) { text = null; }

      if (text) {
        try { parsed = JSON.parse(text); } catch (e) { S.flags.badData = true; }
        if (parsed && typeof parsed === 'object') {
          if (Number(parsed.version) > 2) {
            S.flags.versionHigh = true;
          } else {
            raw = parsed;
          }
        } else if (parsed !== null) {
          S.flags.badData = true;
        }
      }

      if (!raw && !S.flags.versionHigh) {
        try {
          var b = localStorage.getItem(BAK);
          if (b) {
            var bp = JSON.parse(b);
            if (bp && typeof bp === 'object' && Number(bp.version || 2) <= 2) {
              raw = bp;
              S.flags.restored = true;
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (raw && !S.flags.restored) {
        var needMigrate = Number(raw.version) !== 2 || !Array.isArray(raw.records) || !Array.isArray(raw.savings);
        if (needMigrate) {
          try { localStorage.setItem(BAK, JSON.stringify(raw)); } catch (e) { /* ignore */ }
        }
      }
    }

    S.state = normalize(raw);
    return S.state;
  }

  function save() {
    if (!S.state) S.state = defaultState();
    if (S.flags.versionHigh) return false; // 不覆盖更高版本的数据
    S.state.meta.updatedAt = U.nowIso();
    if (!S.storageOk) {
      S.flags.memory = true;
      return false;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(S.state));
      return true;
    } catch (e) {
      S.flags.quota = true;
      return false;
    }
  }

  function replaceState(raw) {
    S.state = normalize(raw);
    save();
    return S.state;
  }

  function exportJSON() {
    return JSON.stringify(S.state, null, 2);
  }

  function sizeBytes() {
    try { return new Blob([JSON.stringify(S.state)]).size; } catch (e) {
      return JSON.stringify(S.state).length * 2;
    }
  }

  function markBackedUp() {
    S.state.meta.lastBackupAt = U.nowIso();
    save();
  }

  function importJSON(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) {
      return { ok: false, error: '这不是有效的 JSON 文件' };
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.records)) {
      return { ok: false, error: '这不像是小账本的备份文件' };
    }
    if (Number(data.version) > 2) {
      return { ok: false, error: '备份来自更高版本，请先升级再导入' };
    }

    var old = JSON.stringify(S.state);
    try { localStorage.setItem(PRE, old); } catch (e) { /* ignore */ }

    S.state = normalize(data);
    S.state.meta.demo = !!(data.meta && data.meta.demo);
    save();
    return { ok: true };
  }

  function hasSnapshot() {
    try { return !!localStorage.getItem(PRE); } catch (e) { return false; }
  }

  function restoreSnapshot() {
    var t = null;
    try { t = localStorage.getItem(PRE); } catch (e) { return false; }
    if (!t) return false;
    var raw;
    try { raw = JSON.parse(t); } catch (e) { return false; }

    try { localStorage.setItem(PRE, JSON.stringify(S.state)); } catch (e) { /* ignore */ }
    S.state = normalize(raw);
    save();
    return true;
  }

  function clearAll() {
    S.state = defaultState();
    save();
  }

  var store = {
    KEY: KEY,
    get state() { return S.state; },
    set state(v) { S.state = v; },
    flags: S.flags,
    get storageOk() { return S.storageOk; },
    defaultState: defaultState,
    normalize: normalize,
    load: load,
    save: save,
    replaceState: replaceState,
    exportJSON: exportJSON,
    sizeBytes: sizeBytes,
    markBackedUp: markBackedUp,
    importJSON: importJSON,
    hasSnapshot: hasSnapshot,
    restoreSnapshot: restoreSnapshot,
    clearAll: clearAll
  };
  App.store = store;
})(window.App);
