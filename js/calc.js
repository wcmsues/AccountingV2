/* =========================================================
   小账本 · 计算层
   纯读取：月度汇总 / 区间汇总 / 分类聚合 / 趋势 / 固定收支状态
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;

  function st() { return App.store.state || App.store.defaultState(); }

  /* ---------- 流水 ---------- */
  function recordsOf(ym, type) {
    return st().records.filter(function (r) {
      return U.ymOf(r.date) === ym && (!type || r.type === type);
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }

  function summary(ym) {
    var income = 0, expense = 0, count = 0, expCount = 0;
    st().records.forEach(function (r) {
      if (U.ymOf(r.date) !== ym) return;
      count++;
      if (r.type === 'income') income += r.amount;
      else { expense += r.amount; expCount++; }
    });
    return { income: income, expense: expense, net: income - expense, count: count, expCount: expCount };
  }

  /* 日均支出：当月按已过天数算 */
  function avgDailyExpense(ym) {
    var s = summary(ym);
    if (!s.expCount) return 0;
    var days = ym === U.currentYm()
      ? parseInt(U.todayStr().slice(8, 10), 10)
      : U.daysInYm(ym);
    return Math.round(s.expense / Math.max(1, days));
  }

  function catBreakdown(ym, type) {
    type = type || 'expense';
    var map = {};
    var count = {};
    var total = 0;
    recordsOf(ym, type).forEach(function (r) {
      map[r.categoryId] = (map[r.categoryId] || 0) + r.amount;
      count[r.categoryId] = (count[r.categoryId] || 0) + 1;
      total += r.amount;
    });
    return Object.keys(map).map(function (id) {
      return {
        cat: U.cat(type, id),
        amount: map[id],
        pct: total > 0 ? (map[id] / total) * 100 : 0,
        count: count[id] || 0
      };
    }).sort(function (a, b) { return b.amount - a.amount; });
  }

  function monthList(ym, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(U.shiftYm(ym, -i));
    return out;
  }

  /* 起止月份之间（含两端）的月份列表 */
  function monthRange(fromYm, toYm) {
    if (!U.isYm(fromYm) || !U.isYm(toYm) || fromYm > toYm) return [];
    var out = [];
    var m = fromYm;
    var guard = 0;
    while (m <= toYm && guard++ < 600) {
      out.push(m);
      m = U.shiftYm(m, 1);
    }
    return out;
  }

  /* 可选范围内每月的收入 / 支出 / 结余 */
  function trendRange(fromYm, toYm) {
    return monthRange(fromYm, toYm).map(function (m) {
      var s = summary(m);
      return { ym: m, label: U.ymShort(m), income: s.income, expense: s.expense, net: s.net };
    });
  }

  /* 有流水的最早月份；最晚月份至少到当月 */
  function recordYmRange() {
    var min = null;
    st().records.forEach(function (r) {
      var m = U.ymOf(r.date);
      if (U.isYm(m) && (!min || m < min)) min = m;
    });
    var cur = U.currentYm();
    if (!min) min = cur;
    return { min: min, max: cur };
  }

  /* 任意日期区间内的收入 / 支出汇总（含两端） */
  function summaryBetween(fromDs, toDs) {
    var income = 0, expense = 0, count = 0, expCount = 0;
    st().records.forEach(function (r) {
      if (r.date < fromDs || r.date > toDs) return;
      count++;
      if (r.type === 'income') income += r.amount;
      else { expense += r.amount; expCount++; }
    });
    return { income: income, expense: expense, net: income - expense, count: count, expCount: expCount };
  }

  /* 按日分组（日期倒序，组内最新在前） */
  function groupByDay(list) {
    var map = {}, out = [];
    list.forEach(function (r) {
      if (!map[r.date]) {
        map[r.date] = { date: r.date, income: 0, expense: 0, items: [] };
        out.push(map[r.date]);
      }
      map[r.date].items.push(r);
      if (r.type === 'income') map[r.date].income += r.amount;
      else map[r.date].expense += r.amount;
    });
    out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    out.forEach(function (g) {
      g.items.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    });
    return out;
  }

  /* ---------- 固定收支 ---------- */
  function fixedKey(fixedId, ym) { return fixedId + '@' + ym; }

  function fixedRecord(fixedId, ym) {
    return st().records.filter(function (r) {
      return r.source === 'fixed' && r.fixedId === fixedId && U.ymOf(r.date) === ym;
    })[0] || null;
  }

  function fixedStatus(ym) {
    var s = st();
    var todayDay = parseInt(U.todayStr().slice(8, 10), 10);
    return s.fixedItems.map(function (it) {
      var inRange = (!it.startMonth || ym >= it.startMonth) && (!it.endMonth || ym <= it.endMonth);
      var due = ym === U.currentYm() ? it.day <= todayDay : true;
      var rec = fixedRecord(it.id, ym);
      return {
        item: it,
        record: rec,
        posted: !!rec,
        suppressed: !!s.suppressedFixed[fixedKey(it.id, ym)],
        inRange: inRange,
        due: due,
        enabled: it.enabled
      };
    });
  }

  function pendingFixed(ym) {
    return fixedStatus(ym).filter(function (x) {
      return x.enabled && x.inRange && x.due && !x.posted && !x.suppressed;
    });
  }

  function budget(ym) {
    var b = st().settings.monthlyBudget;
    if (!b) return null;
    var used = summary(ym).expense;
    return { budget: b, used: used, pct: (used / b) * 100, remaining: b - used };
  }

  App.calc = {
    recordsOf: recordsOf,
    summary: summary,
    summaryBetween: summaryBetween,
    avgDailyExpense: avgDailyExpense,
    catBreakdown: catBreakdown,
    monthList: monthList,
    monthRange: monthRange,
    trendRange: trendRange,
    recordYmRange: recordYmRange,
    groupByDay: groupByDay,
    fixedKey: fixedKey,
    fixedRecord: fixedRecord,
    fixedStatus: fixedStatus,
    pendingFixed: pendingFixed,
    budget: budget
  };
})(window.App);
