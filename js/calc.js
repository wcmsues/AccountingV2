/* =========================================================
   小账本 · 计算层
   纯读取：月度汇总 / 分类聚合 / 趋势 / 目标进度 / 固定收支状态
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
    var total = 0;
    recordsOf(ym, type).forEach(function (r) {
      map[r.categoryId] = (map[r.categoryId] || 0) + r.amount;
      total += r.amount;
    });
    return Object.keys(map).map(function (id) {
      return {
        cat: U.cat(type, id),
        amount: map[id],
        pct: total > 0 ? (map[id] / total) * 100 : 0
      };
    }).sort(function (a, b) { return b.amount - a.amount; });
  }

  function monthList(ym, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(U.shiftYm(ym, -i));
    return out;
  }

  function trend(ym, n) {
    return monthList(ym, n || 6).map(function (m) {
      var s = summary(m);
      return { ym: m, label: U.ymShort(m), income: s.income, expense: s.expense };
    });
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

  function groupSavingsByDay(list) {
    var map = {}, out = [];
    list.forEach(function (r) {
      if (!map[r.date]) {
        map[r.date] = { date: r.date, inSum: 0, outSum: 0, items: [] };
        out.push(map[r.date]);
      }
      map[r.date].items.push(r);
      if (r.type === 'in') map[r.date].inSum += r.amount;
      else map[r.date].outSum += r.amount;
    });
    out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return out;
  }

  /* ---------- 存款 / 存钱目标 ---------- */
  function savingsBalance() {
    var s = st();
    var t = s.settings.startBalance;
    s.savings.forEach(function (x) {
      t += x.type === 'in' ? x.amount : -x.amount;
    });
    return t;
  }

  function savingsBalanceAt(ym) {
    var s = st();
    var end = ym + '-31';
    var t = s.settings.startBalance;
    s.savings.forEach(function (x) {
      if (x.date <= end) t += x.type === 'in' ? x.amount : -x.amount;
    });
    return t;
  }

  function savingsSummary(ym) {
    var s = st();
    var inM = 0, outM = 0, inAll = 0, outAll = 0;
    s.savings.forEach(function (x) {
      if (x.type === 'in') {
        inAll += x.amount;
        if (U.ymOf(x.date) === ym) inM += x.amount;
      } else {
        outAll += x.amount;
        if (U.ymOf(x.date) === ym) outM += x.amount;
      }
    });
    return {
      monthIn: inM, monthOut: outM,
      totalIn: inAll, totalOut: outAll,
      balance: s.settings.startBalance + inAll - outAll
    };
  }

  function savingsSeries(ym, n) {
    return monthList(ym, n || 6).map(function (m) {
      return { ym: m, label: U.ymShort(m), value: savingsBalanceAt(m) };
    });
  }

  function goalProgress() {
    var s = st();
    var g = s.goal;
    if (!g) return null;

    var total = savingsBalance();
    var saved = Math.max(0, total - (g.baseline || 0));
    var target = g.targetAmount;
    var achieved = saved >= target;
    var remaining = Math.max(0, target - saved);
    var pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;

    var net3 = 0;
    monthList(U.currentYm(), 3).forEach(function (m) {
      var ss = savingsSummary(m);
      net3 += ss.monthIn - ss.monthOut;
    });
    var avg = net3 / 3;

    var etaYm = null;
    var etaText = '';
    if (achieved) {
      etaText = '继续保持这个节奏';
    } else if (avg > 100) {
      var need = Math.max(1, Math.ceil(remaining / avg));
      etaYm = U.shiftYm(U.currentYm(), need);
      etaText = '按近 3 个月节奏，预计 ' + U.ymLabel(etaYm) + ' 达成';
    } else {
      etaText = '近 3 个月还没存下钱，先从小目标开始';
    }

    return {
      goal: g,
      saved: saved,
      target: target,
      pct: pct,
      remaining: remaining,
      achieved: achieved,
      avg: avg,
      etaYm: etaYm,
      etaText: etaText,
      balance: total,
      deadline: g.deadline
    };
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
    avgDailyExpense: avgDailyExpense,
    catBreakdown: catBreakdown,
    monthList: monthList,
    trend: trend,
    groupByDay: groupByDay,
    groupSavingsByDay: groupSavingsByDay,
    savingsBalance: savingsBalance,
    savingsBalanceAt: savingsBalanceAt,
    savingsSummary: savingsSummary,
    savingsSeries: savingsSeries,
    goalProgress: goalProgress,
    fixedKey: fixedKey,
    fixedRecord: fixedRecord,
    fixedStatus: fixedStatus,
    pendingFixed: pendingFixed,
    budget: budget
  };
})(window.App);
