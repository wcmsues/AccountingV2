/* =========================================================
   小账本 · 写操作
   所有改动都经过这里：改 state -> save -> 由 app 触发重渲染
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;

  function st() { return App.store.state; }
  function save() { return App.store.save(); }
  function findRecord(id) {
    var list = st().records;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function hasAnyData() {
    var s = st();
    return s.records.length > 0 || s.savings.length > 0 || s.fixedItems.length > 0 || !!s.goal;
  }

  /* ---------- 收支流水 ---------- */
  function addRecord(input) {
    var amount = Math.round(Number(input.amount));
    if (!isFinite(amount) || amount <= 0) return null;
    var type = input.type === 'income' ? 'income' : 'expense';
    var now = U.nowIso();
    var rec = {
      id: U.uid('r'),
      type: type,
      amount: amount,
      categoryId: input.categoryId || U.cat(type).id,
      date: U.isDate(input.date) ? input.date : U.todayStr(),
      note: String(input.note || '').trim().slice(0, 40),
      source: 'manual',
      fixedId: null,
      createdAt: now,
      updatedAt: now
    };
    st().records.push(rec);
    save();
    return rec;
  }

  function updateRecord(id, patch) {
    var rec = findRecord(id);
    if (!rec) return null;
    if (patch.type) rec.type = patch.type === 'income' ? 'income' : 'expense';
    if (patch.amount != null) {
      var amount = Math.round(Number(patch.amount));
      if (isFinite(amount) && amount > 0) rec.amount = amount;
    }
    if (patch.categoryId) rec.categoryId = patch.categoryId;
    if (U.isDate(patch.date)) rec.date = patch.date;
    if (patch.note != null) rec.note = String(patch.note).trim().slice(0, 40);
    rec.updatedAt = U.nowIso();
    save();
    return rec;
  }

  function deleteRecord(id) {
    var rec = findRecord(id);
    if (!rec) return null;
    st().records = st().records.filter(function (r) { return r.id !== id; });
    if (rec.source === 'fixed' && rec.fixedId) {
      st().suppressedFixed[App.calc.fixedKey(rec.fixedId, U.ymOf(rec.date))] = Date.now();
    }
    save();
    return rec;
  }

  function restoreRecord(rec) {
    if (!rec) return false;
    if (rec.source === 'fixed' && rec.fixedId) {
      delete st().suppressedFixed[App.calc.fixedKey(rec.fixedId, U.ymOf(rec.date))];
    }
    if (findRecord(rec.id)) return false;
    st().records.push(rec);
    save();
    return true;
  }

  /* ---------- 固定收支 ---------- */
  function findFixed(id) {
    var list = st().fixedItems;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function addFixed(input) {
    var amount = Math.round(Number(input.amount));
    var name = String(input.name || '').trim();
    if (!name || !isFinite(amount) || amount <= 0) return null;
    var type = input.type === 'income' ? 'income' : 'expense';
    var it = {
      id: U.uid('fx'),
      type: type,
      name: name.slice(0, 20),
      amount: amount,
      categoryId: input.categoryId || U.cat(type).id,
      day: U.clamp(Math.round(Number(input.day) || 1), 1, 31),
      enabled: true,
      startMonth: U.isYm(input.startMonth) ? input.startMonth : U.currentYm(),
      endMonth: U.isYm(input.endMonth) ? input.endMonth : null
    };
    st().fixedItems.push(it);
    save();
    // 新增后立刻尝试补记（只补已到期）
    autoPostFixed();
    return it;
  }

  function updateFixed(id, patch) {
    var it = findFixed(id);
    if (!it) return null;
    if (patch.name != null) {
      var n = String(patch.name).trim();
      if (n) it.name = n.slice(0, 20);
    }
    if (patch.amount != null) {
      var a = Math.round(Number(patch.amount));
      if (isFinite(a) && a > 0) it.amount = a;
    }
    if (patch.type) it.type = patch.type === 'income' ? 'income' : 'expense';
    if (patch.categoryId) it.categoryId = patch.categoryId;
    if (patch.day != null) it.day = U.clamp(Math.round(Number(patch.day)) || 1, 1, 31);
    if (typeof patch.enabled === 'boolean') it.enabled = patch.enabled;
    save();
    return it;
  }

  function toggleFixed(id) {
    var it = findFixed(id);
    if (!it) return null;
    it.enabled = !it.enabled;
    save();
    return it;
  }

  function deleteFixed(id) {
    st().fixedItems = st().fixedItems.filter(function (x) { return x.id !== id; });
    save();
  }

  function fixedDateFor(it, ym) {
    var day = Math.min(it.day, U.daysInYm(ym));
    if (ym === U.currentYm()) {
      var td = parseInt(U.todayStr().slice(8, 10), 10);
      if (day > td) day = td;
    }
    return ym + '-' + U.pad2(day);
  }

  /* 手动补记：不受「已到期」限制；会清掉墓碑 */
  function postFixed(fixedId, ym) {
    ym = U.isYm(ym) ? ym : U.currentYm();
    var it = findFixed(fixedId);
    if (!it) return null;
    if (App.calc.fixedRecord(it.id, ym)) return null;

    var key = App.calc.fixedKey(it.id, ym);
    delete st().suppressedFixed[key];

    var now = U.nowIso();
    var rec = {
      id: 'fx_' + it.id + '_' + ym.replace('-', ''),
      type: it.type,
      amount: it.amount,
      categoryId: it.categoryId,
      date: fixedDateFor(it, ym),
      note: it.name,
      source: 'fixed',
      fixedId: it.id,
      createdAt: now,
      updatedAt: now
    };
    st().records.push(rec);
    save();
    return rec;
  }

  /* 撤销本月已记入的固定账：写墓碑，避免下次启动又补回来 */
  function undoFixed(fixedId, ym) {
    var rec = App.calc.fixedRecord(fixedId, ym);
    if (!rec) return false;
    st().records = st().records.filter(function (r) { return r.id !== rec.id; });
    st().suppressedFixed[App.calc.fixedKey(fixedId, ym)] = Date.now();
    save();
    return true;
  }

  /* 幂等自动补记：确定性 ID + 业务键复查 + 墓碑表 */
  function autoPostFixed() {
    var s = st();
    if (!s || s.settings.autoPostFixed === 'off') return 0;

    var ym = U.currentYm();
    var todayDay = parseInt(U.todayStr().slice(8, 10), 10);
    var added = 0;

    s.fixedItems.forEach(function (it) {
      if (!it.enabled) return;
      if (it.startMonth && ym < it.startMonth) return;
      if (it.endMonth && ym > it.endMonth) return;
      if (s.settings.autoPostFixed === 'due' && it.day > todayDay) return;
      if (s.suppressedFixed[App.calc.fixedKey(it.id, ym)]) return;
      if (App.calc.fixedRecord(it.id, ym)) return;

      var now = U.nowIso();
      s.records.push({
        id: 'fx_' + it.id + '_' + ym.replace('-', ''),
        type: it.type,
        amount: it.amount,
        categoryId: it.categoryId,
        date: fixedDateFor(it, ym),
        note: it.name,
        source: 'fixed',
        fixedId: it.id,
        createdAt: now,
        updatedAt: now
      });
      added++;
    });

    if (added) {
      s.meta.lastAutoPostYm = ym;
      save();
    }
    return added;
  }

  /* ---------- 存钱 ---------- */
  function addSaving(input) {
    var amount = Math.round(Number(input.amount));
    if (!isFinite(amount) || amount <= 0) return null;
    var item = {
      id: U.uid('sv'),
      type: input.type === 'out' ? 'out' : 'in',
      amount: amount,
      date: U.isDate(input.date) ? input.date : U.todayStr(),
      note: String(input.note || '').trim().slice(0, 30),
      createdAt: U.nowIso()
    };
    st().savings.push(item);
    syncGoal();
    save();
    return item;
  }

  function removeSaving(id) {
    var list = st().savings;
    var found = null;
    st().savings = list.filter(function (x) {
      if (x.id === id) { found = x; return false; }
      return true;
    });
    if (!found) return null;
    syncGoal();
    save();
    return found;
  }

  function restoreSaving(item) {
    if (!item) return false;
    st().savings.push(item);
    syncGoal();
    save();
    return true;
  }

  /* ---------- 存钱目标 ---------- */
  function syncGoal() {
    var s = st();
    if (!s.goal) return;
    var p = App.calc.goalProgress();
    if (!p) return;
    if (p.achieved && s.goal.status !== 'achieved') {
      s.goal.status = 'achieved';
      s.goal.achievedAt = U.nowIso();
    } else if (!p.achieved && s.goal.status === 'achieved') {
      s.goal.status = 'active';
      s.goal.achievedAt = null;
    }
  }

  function setGoal(input) {
    var target = Math.round(Number(input.targetAmount));
    if (!isFinite(target) || target <= 0) return null;
    var s = st();
    s.goal = {
      id: U.uid('g'),
      name: String(input.name || '存钱目标').trim().slice(0, 20) || '存钱目标',
      targetAmount: target,
      baseline: input.fromNow ? App.calc.savingsBalance() : 0,
      deadline: U.isDate(input.deadline) ? input.deadline : null,
      status: 'active',
      achievedAt: null,
      createdAt: U.nowIso()
    };
    syncGoal();
    save();
    return s.goal;
  }

  function adjustGoal(targetAmount) {
    var s = st();
    if (!s.goal) return null;
    var target = Math.round(Number(targetAmount));
    if (!isFinite(target) || target <= 0) return null;
    s.goal.targetAmount = target;
    if (s.goal.status === 'achieved' && App.calc.goalProgress() && !App.calc.goalProgress().achieved) {
      s.goal.status = 'active';
      s.goal.achievedAt = null;
    }
    syncGoal();
    save();
    return s.goal;
  }

  function updateGoal(patch) {
    var s = st();
    if (!s.goal) return null;
    if (patch.name != null) {
      var n = String(patch.name).trim();
      if (n) s.goal.name = n.slice(0, 20);
    }
    if (patch.targetAmount != null) {
      var t = Math.round(Number(patch.targetAmount));
      if (isFinite(t) && t > 0) s.goal.targetAmount = t;
    }
    if (patch.deadline === null) s.goal.deadline = null;
    else if (U.isDate(patch.deadline)) s.goal.deadline = patch.deadline;
    syncGoal();
    save();
    return s.goal;
  }

  function resetGoal(input) {
    var s = st();
    if (s.goal) {
      var p = App.calc.goalProgress();
      s.goalHistory.unshift({
        id: s.goal.id,
        name: s.goal.name,
        targetAmount: s.goal.targetAmount,
        baseline: s.goal.baseline,
        status: s.goal.status,
        achievedAt: s.goal.achievedAt,
        savedAmount: p ? p.saved : 0,
        archivedAt: U.nowIso()
      });
    }
    return setGoal(input);
  }

  /* ---------- 设置 ---------- */
  function setSetting(key, value) {
    var s = st();
    if (key === 'startBalance') {
      var v = Math.round(Number(value));
      if (!isFinite(v)) return false;
      s.settings.startBalance = v; // 可为负，单位分
    } else if (key === 'monthlyBudget') {
      var b = Math.round(Number(value));
      s.settings.monthlyBudget = isFinite(b) ? Math.max(0, b) : 0;
    } else if (key === 'autoPostFixed') {
      if (['due', 'monthStart', 'off'].indexOf(value) < 0) return false;
      s.settings.autoPostFixed = value;
    } else {
      return false;
    }
    save();
    return true;
  }

  /* ---------- 示例数据 ---------- */
  function buildDemo() {
    var seed = 20261030;
    function rnd() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }
    function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
    function range(min, max, step) {
      var n = Math.floor((max - min) / step) + 1;
      return min + Math.floor(rnd() * n) * step;
    }

    var now = U.nowIso();
    var ymNow = U.currentYm();
    var todayDay = parseInt(U.todayStr().slice(8, 10), 10);
    var startYm = U.shiftYm(ymNow, -5);

    var s = {
      version: 2,
      meta: { createdAt: now, updatedAt: now, lastAutoPostYm: '', lastBackupAt: '', demo: true },
      settings: { startBalance: 800000, monthlyBudget: 700000, autoPostFixed: 'due' },
      records: [],
      fixedItems: [
        { id: 'demo_rent', type: 'expense', name: '房租', amount: 450000, categoryId: 'home', day: 5, enabled: true, startMonth: startYm, endMonth: null },
        { id: 'demo_util', type: 'expense', name: '水电网', amount: 26000, categoryId: 'home', day: 12, enabled: true, startMonth: startYm, endMonth: null },
        { id: 'demo_sub', type: 'expense', name: '宽带 + 会员', amount: 9900, categoryId: 'fun', day: 18, enabled: true, startMonth: startYm, endMonth: null },
        { id: 'demo_salary', type: 'income', name: '工资', amount: 1580000, categoryId: 'salary', day: 10, enabled: true, startMonth: startYm, endMonth: null }
      ],
      savings: [],
      goal: {
        id: 'demo_goal',
        name: '旅行基金',
        targetAmount: 3000000,
        baseline: 0,
        deadline: '2027-06-30',
        status: 'active',
        achievedAt: null,
        createdAt: now
      },
      goalHistory: [],
      suppressedFixed: {}
    };

    var notes = {
      food: ['午饭', '咖啡', '晚饭', '早餐', '外卖', '奶茶', '水果'],
      daily: ['超市', '纸巾', '洗衣液', '牙膏', '家居小物'],
      traffic: ['地铁', '打车', '公交', '共享单车'],
      home: ['水电费', '物业费', '家居', '快递'],
      fun: ['电影', '游戏', '演出', '唱歌'],
      study: ['买书', '网课', '文具'],
      social: ['红包', '礼物', '请客'],
      medical: ['感冒药', '体检', '门诊'],
      other: ['杂项', '其他']
    };
    var ranges = {
      food: [1200, 6800], daily: [900, 12800], traffic: [200, 4800],
      home: [1500, 25000], fun: [2500, 18000], study: [3000, 26000],
      social: [5000, 40000], medical: [1500, 20000], other: [800, 8000]
    };
    var weights = [
      ['food', 34], ['daily', 14], ['traffic', 15], ['home', 6], ['fun', 10],
      ['study', 5], ['social', 5], ['medical', 3], ['other', 8]
    ];
    var weightTotal = weights.reduce(function (a, x) { return a + x[1]; }, 0);

    function pickCat() {
      var r = rnd() * weightTotal;
      for (var i = 0; i < weights.length; i++) {
        r -= weights[i][1];
        if (r <= 0) return weights[i][0];
      }
      return 'food';
    }

    function addRec(month, day, type, amount, categoryId, note, source, fixedId) {
      if (month === ymNow && day > todayDay) return;
      var date = month + '-' + U.pad2(Math.min(day, U.daysInYm(month)));
      s.records.push({
        id: source === 'fixed' ? 'fx_' + fixedId + '_' + month.replace('-', '') : U.uid('r'),
        type: type,
        amount: amount,
        categoryId: categoryId,
        date: date,
        note: note,
        source: source || 'manual',
        fixedId: fixedId || null,
        createdAt: date + 'T0' + (day % 10) + ':00:00.000Z',
        updatedAt: date + 'T0' + (day % 10) + ':00:00.000Z'
      });
    }

    for (var i = 5; i >= 0; i--) {
      var m = U.shiftYm(ymNow, -i);
      var days = U.daysInYm(m);

      // 固定收支
      s.fixedItems.forEach(function (it) {
        addRec(m, it.day, it.type, it.amount, it.categoryId, it.name, 'fixed', it.id);
      });

      // 日常支出
      var count = 16 + Math.floor(rnd() * 9);
      if (m === ymNow) count = Math.max(4, Math.round(count * todayDay / days));
      for (var j = 0; j < count; j++) {
        var catId = pickCat();
        var r = ranges[catId];
        var day = 1 + Math.floor(rnd() * (m === ymNow ? todayDay : days));
        addRec(m, day, 'expense', range(r[0], r[1], 100), catId, pick(notes[catId]), 'manual', null);
      }

      // 存钱
      if (m !== ymNow || todayDay >= 15) {
        s.savings.push({
          id: U.uid('sv'),
          type: 'in',
          amount: 200000,
          date: m + '-15',
          note: '每月存一点',
          createdAt: m + '-15T09:00:00.000Z'
        });
      }
      if (i === 4) {
        var extra = Math.min(20, days);
        if (m !== ymNow || todayDay >= extra) {
          s.savings.push({
            id: U.uid('sv'),
            type: 'in',
            amount: 500000,
            date: m + '-' + U.pad2(extra),
            note: '项目结余',
            createdAt: m + '-' + U.pad2(extra) + 'T10:00:00.000Z'
          });
        }
      }
      if (i === 2) {
        var wd = Math.min(22, days);
        if (m !== ymNow || todayDay >= wd) {
          s.savings.push({
            id: U.uid('sv'),
            type: 'out',
            amount: 120000,
            date: m + '-' + U.pad2(wd),
            note: '应急支出',
            createdAt: m + '-' + U.pad2(wd) + 'T11:00:00.000Z'
          });
        }
      }
    }

    // 额外收入
    var bonusYm = U.shiftYm(ymNow, -4);
    addRec(bonusYm, 20, 'income', 300000, 'bonus', '季度奖金', 'manual', null);
    var sideYm = U.shiftYm(ymNow, -2);
    addRec(sideYm, 8, 'income', 68000, 'side', '接了个小活', 'manual', null);

    s.records.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

    // 目标状态
    if (s.goal) {
      var balance = s.settings.startBalance;
      s.savings.forEach(function (x) {
        balance += x.type === 'in' ? x.amount : -x.amount;
      });
      if (balance >= s.goal.targetAmount) {
        s.goal.status = 'achieved';
        s.goal.achievedAt = now;
      }
    }

    return s;
  }

  function loadDemo() {
    App.store.replaceState(buildDemo());
    autoPostFixed();
    return true;
  }

  App.actions = {
    hasAnyData: hasAnyData,
    addRecord: addRecord,
    updateRecord: updateRecord,
    deleteRecord: deleteRecord,
    restoreRecord: restoreRecord,
    addFixed: addFixed,
    updateFixed: updateFixed,
    toggleFixed: toggleFixed,
    deleteFixed: deleteFixed,
    postFixed: postFixed,
    undoFixed: undoFixed,
    autoPostFixed: autoPostFixed,
    addSaving: addSaving,
    removeSaving: removeSaving,
    restoreSaving: restoreSaving,
    setGoal: setGoal,
    adjustGoal: adjustGoal,
    resetGoal: resetGoal,
    updateGoal: updateGoal,
    setSetting: setSetting,
    loadDemo: loadDemo,
    buildDemo: buildDemo
  };
})(window.App);
