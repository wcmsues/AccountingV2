/* =========================================================
   小账本 · 首页
   新手引导 / 结余大卡 / 收支三宫格 / 预算 / 待记入 / 每日收支日历 / 支出环形图 + 分类排行 / 收支趋势
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;
  var C = App.calc;
  var S = App.store;
  var A = App.actions;

  var ym = U.currentYm();            // 首页当前查看的月份，由顶部下拉日历切换
  var trendFrom = null;              // 趋势图手动选择的起止月份，null 时默认近 12 个月
  var trendTo = null;
  var els = {};
  var bound = false;

  /* 结余卡上的小猪插画 */
  var PIG =
    '<svg viewBox="0 0 140 120" aria-hidden="true">' +
      '<ellipse cx="70" cy="106" rx="46" ry="7" fill="#C9A88F" opacity=".22"/>' +
      '<ellipse cx="45" cy="26" rx="9.5" ry="14" transform="rotate(-26 45 26)" fill="#EFA695"/>' +
      '<ellipse cx="95" cy="26" rx="9.5" ry="14" transform="rotate(26 95 26)" fill="#EFA695"/>' +
      '<ellipse cx="70" cy="64" rx="44" ry="34" fill="#F7BFAF"/>' +
      '<rect x="40" y="88" width="13" height="16" rx="5.5" fill="#EFA695"/>' +
      '<rect x="88" y="88" width="13" height="16" rx="5.5" fill="#EFA695"/>' +
      '<ellipse cx="112" cy="62" rx="12" ry="9" fill="#EFA695"/>' +
      '<ellipse cx="108" cy="61" rx="1.7" ry="2.3" fill="#9C5F52"/>' +
      '<ellipse cx="116" cy="61" rx="1.7" ry="2.3" fill="#9C5F52"/>' +
      '<circle cx="92" cy="50" r="3.4" fill="#4A3B36"/>' +
      '<circle cx="93.2" cy="48.8" r="1.1" fill="#fff"/>' +
      '<ellipse cx="84" cy="67" rx="6.5" ry="4" fill="#EE9C8C" opacity=".55"/>' +
      '<path d="M26 58c-9-1-12 8-5 12 6 3 9-4 4-6" stroke="#EFA695" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<rect x="58" y="36" width="24" height="5.5" rx="2.75" fill="#DE8878"/>' +
      '<g class="coin-float">' +
        '<circle cx="70" cy="20" r="9" fill="#F8D67F" stroke="#E3B75C" stroke-width="2"/>' +
        '<text x="70" y="24" text-anchor="middle" font-size="10" fill="#B8862B" font-weight="700" font-family="sans-serif">¥</text>' +
      '</g>' +
    '</svg>';

  function init() {
    els.empty = document.getElementById('homeEmpty');
    els.hero = document.getElementById('homeHero');
    els.stats = document.getElementById('homeStats');
    els.budget = document.getElementById('homeBudget');
    els.pending = document.getElementById('homePending');
    els.calendar = document.getElementById('homeCalendar');
    els.catRank = document.getElementById('homeCatRank');
    els.trend = document.getElementById('homeTrendCard');
    els.tip = document.getElementById('homeBackupTip');

    if (bound) return;   // 幂等：重渲染复用同一批监听
    bound = true;

    els.empty.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'go') {
        App.switchTab('ledger');
      } else if (act === 'demo') {
        A.loadDemo();
        App.refreshAll();
        App.ui.toast('示例数据已就位，随便点两下看看');
      }
    });

    els.pending.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-post]');
      if (!btn) return;
      var list = C.pendingFixed(ym);
      var n = 0;
      list.forEach(function (x) {
        if (A.postFixed(x.item.id, ym)) n++;
      });
      App.refreshAll();
      if (n) App.ui.toast('补记了 ' + n + ' 笔，可在明细里修改');
    });

    els.catRank.addEventListener('click', function (e) {
      var row = e.target.closest('[data-cat]');
      if (!row) return;
      openCatDetail(row.getAttribute('data-cat'));
    });

    els.trend.addEventListener('change', function (e) {
      var sel = e.target;
      if (!sel || (sel.id !== 'trendFrom' && sel.id !== 'trendTo')) return;
      var b = trendBounds();
      // 起点晚于终点时，把另一端一起拉过来，保证区间有效
      var from = sel.id === 'trendFrom' ? sel.value : b.from;
      var to = sel.id === 'trendTo' ? sel.value : b.to;
      if (from > to) {
        if (sel.id === 'trendFrom') to = from;
        else from = to;
      }
      trendFrom = from;
      trendTo = to;
      App.refresh();
    });

    els.calendar.addEventListener('click', function (e) {
      var cell = e.target.closest('[data-date]');
      if (!cell) return;
      openDayDetail(cell.getAttribute('data-date'));
    });

    els.tip.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'export') {
        App.exportBackup();
      } else if (act === 'clear-demo') {
        App.ui.confirm({
          title: '清空示例数据？',
          text: '会删掉所有示例流水和固定收支，然后从零开始。',
          okText: '清空',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          S.clearAll();
          ym = U.currentYm();
          App.refreshAll();
          App.ui.toast('已清空，开始记你自己的账吧');
        });
      }
    });
  }

  function openRecord(rec) {
    var c = U.cat(rec.type, rec.categoryId);
    var sub = U.relDay(rec.date) + ' · ' + c.name + (rec.note ? ' · ' + rec.note : '');
    App.ui.actionSheet(
      (rec.type === 'income' ? '+' : '-') + '¥' + U.money(rec.amount),
      sub,
      [
        {
          label: '编辑这笔',
          icon: 'i-edit',
          onClick: function () {
            App.views.ledger.editRecord(rec.id);
          }
        },
        {
          label: '删除这笔',
          icon: 'i-trash',
          danger: true,
          onClick: function () {
            App.ui.confirm({
              title: '删除这笔记录？',
              text: '删除后可以撤销。',
              okText: '删除',
              danger: true
            }).then(function (ok) {
              if (!ok) return;
              var removed = A.deleteRecord(rec.id);
              App.refreshAll();
              App.ui.toast('已删除', {
                actionLabel: '撤销',
                onAction: function () { A.restoreRecord(removed); App.refreshAll(); }
              });
            });
          }
        }
      ]
    );
  }

  function render() {
    if (!els.empty) init();
    var cur = U.currentYm();
    if (ym > cur) ym = cur;

    var sum = C.summary(ym);
    renderEmptyGuide();
    renderHero(sum);
    renderStats(sum);
    renderBudget();
    renderPending();
    renderCalendar();
    renderCatRank();
    renderTrend();
    renderTip();
  }

  /* ---------- 新手引导（没有任何数据时） ---------- */
  function renderEmptyGuide() {
    if (A.hasAnyData()) {
      els.empty.innerHTML = '';
      return;
    }
    els.empty.innerHTML =
      '<div class="card guide-card">' +
        '<div class="guide-pig">' + PIG + '</div>' +
        '<h3>从第一笔开始</h3>' +
        '<p>记下今天的一笔花销，或者先载入示例数据看看效果。</p>' +
        '<div class="guide-actions">' +
          '<button class="btn primary" type="button" data-act="go">去记一笔</button>' +
          '<button class="btn" type="button" data-act="demo">载入示例数据</button>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 结余大卡 ---------- */
  function renderHero(sum) {
    var neg = sum.net < 0;
    els.hero.innerHTML =
      '<div class="card hero' + (neg ? ' is-neg' : '') + '">' +
        '<div class="hero-left">' +
          '<span class="eyebrow">' + U.ico('i-wallet', 'sm') +
            (ym === U.currentYm() ? '本月结余' : '当月结余') + '</span>' +
          '<div class="hero-num">' +
            '<span class="cny">' + (neg ? '-¥' : '¥') + '</span>' +
            '<span class="num">' + U.money(Math.abs(sum.net)) + '</span>' +
          '</div>' +
          '<p class="hero-sub">收入 ' + U.money(sum.income) + ' − 支出 ' + U.money(sum.expense) + '</p>' +
          '<p class="hero-meta">共 ' + sum.count + ' 笔 · 日均支出 ¥' + U.money(C.avgDailyExpense(ym)) + '</p>' +
        '</div>' +
        '<div class="hero-pig">' + PIG + '</div>' +
      '</div>';
  }

  /* ---------- 收支三宫格：本月 / 今日 / 本年 ---------- */
  function renderStats(sum) {
    var today = U.todayStr();
    var year = ym.slice(0, 4);
    var todaySum = C.summaryBetween(today, today);
    var yearSum = C.summaryBetween(year + '-01-01', year + '-12-31');

    function cell(label, s) {
      return '<div class="stat pair">' +
        '<div class="st-label">' + label + '</div>' +
        '<div class="st-pair">' +
          '<span class="st-in"><em>收</em>¥' + U.moneyShort(s.income) + '</span>' +
          '<span class="st-out"><em>支</em>¥' + U.moneyShort(s.expense) + '</span>' +
        '</div>' +
      '</div>';
    }

    els.stats.innerHTML =
      cell(ym === U.currentYm() ? '本月收支' : '当月收支', sum) +
      cell('今日收支', todaySum) +
      cell('本年收支', yearSum);
  }

  /* ---------- 预算进度 ---------- */
  function renderBudget() {
    var b = C.budget(ym);
    if (!b) { els.budget.innerHTML = ''; return; }

    var pct = Math.round(b.pct);
    var cls = b.pct >= 100 ? 'is-over' : (b.pct >= 85 ? 'is-warn' : '');
    var label = b.remaining >= 0
      ? '还能花 ¥' + U.money(b.remaining)
      : '已超支 ¥' + U.money(-b.remaining);

    els.budget.innerHTML =
      '<div class="card budget-card ' + cls + '">' +
        '<div class="card-head">' +
          '<h2>' + (ym === U.currentYm() ? '本月预算' : '当月预算') + '</h2>' +
          '<span class="head-sub">已用 ' + pct + '%</span>' +
        '</div>' +
        '<div class="budget-bar"><i style="width:' + U.clamp(pct, 0, 100) + '%"></i></div>' +
        '<div class="budget-legend"><span>支出 ¥' + U.money(b.used) + '</span><span>' + label + '</span></div>' +
      '</div>';
  }

  /* ---------- 待记入的固定收支 ---------- */
  function renderPending() {
    var list = C.pendingFixed(ym);
    if (!list.length) { els.pending.innerHTML = ''; return; }

    var names = list.slice(0, 3).map(function (x) { return x.item.name; }).join('、');
    if (list.length > 3) names += ' 等';

    els.pending.innerHTML =
      '<div class="pending">' +
        '<span class="p-ico">' + U.ico('i-clock') + '</span>' +
        '<div class="p-main">' +
          '<div class="p-title">有 ' + list.length + ' 笔固定收支待记入</div>' +
          '<div class="p-sub">' + U.esc(names) + '</div>' +
        '</div>' +
        '<button class="btn sm primary" type="button" data-post>一键补记</button>' +
      '</div>';
  }

  /* ---------- 本月花在哪：环形图 + 分类排行 ---------- */
  /* 环形图与排名条共用：按金额排名依次取色（支出最多 8 类，色板一一对应） */
  var CAT_COLORS = [
    '#DE7A6A', '#F0B36A', '#8FD0B8', '#9FB8E8',
    '#C9A2D8', '#7FC8C0', '#E6A9B8', '#B8B08A'
  ];

  /* 排行榜里的金额：不带千分位，整数不补 .00 */
  function amtText(fen) {
    return U.money(fen).replace(/\.00$/, '');
  }

  function renderCatRank() {
    var list = C.catBreakdown(ym, 'expense');
    if (!list.length) {
      els.catRank.innerHTML = '';
      return;
    }

    var total = C.summary(ym).expense;
    var max = list[0].amount || 1;
    var current = ym === U.currentYm();

    // 取整后把误差补回第一名，保证所有百分比加起来是 100%
    var pcts = list.map(function (x) { return Math.round(x.pct); });
    var pctSum = 0;
    pcts.forEach(function (v) { pctSum += v; });
    if (list.length > 1 && pctSum !== 100) pcts[0] += 100 - pctSum;

    var rows = list.map(function (x, i) {
      var pct = pcts[i];
      var barW = i === 0 ? 100 : U.clamp(Math.round((x.amount / max) * 100), 3, 100);
      var color = CAT_COLORS[i % CAT_COLORS.length];
      return '<button class="cr-row" type="button" data-cat="' + U.esc(x.cat.id) + '" ' +
          'aria-label="' + U.esc(x.cat.name + ' ¥' + amtText(x.amount) + '，占支出 ' + pct + '%，点击查看明细') + '">' +
        '<span class="cr-top">' +
          '<span class="cr-rank">' + (i + 1) + '</span>' +
          '<span class="cr-ico">' + U.ico(x.cat.icon) + '</span>' +
          '<span class="cr-name">' + U.esc(x.cat.name) + '</span>' +
          '<span class="cr-amt">¥' + amtText(x.amount) + '</span>' +
          '<span class="cr-pct">' + pct + '%</span>' +
        '</span>' +
        '<span class="cr-bar"><i data-w="' + barW + '" style="width:0;background:' + color + '"></i></span>' +
      '</button>';
    }).join('');

    var donutData = list.map(function (x, i) {
      return { label: x.cat.name, value: x.amount, color: CAT_COLORS[i % CAT_COLORS.length] };
    });
    var donutSvg = App.chart.donut(donutData, {
      centerLabel: (current ? '本月支出' : '当月支出'),
      centerValue: '¥' + U.moneyShort(total)
    });

    els.catRank.innerHTML =
      '<div class="card cat-rank">' +
        '<div class="card-head">' +
          '<h2>' + (current ? '本月花在哪' : '当月花在哪') + '</h2>' +
          '<span class="head-sub">' + list.length + ' 类 · ¥' + U.money(total) + '</span>' +
        '</div>' +
        '<div class="cr-donut"><div class="cr-donut-box">' + donutSvg + '</div></div>' +
        '<div class="cr-list">' + rows + '</div>' +
      '</div>';

    requestAnimationFrame(function () {
      var bars = els.catRank.querySelectorAll('.cr-bar i');
      Array.prototype.forEach.call(bars, function (bar) {
        bar.style.width = (bar.getAttribute('data-w') || 0) + '%';
      });
    });
  }

  /* 点分类：该分类当月的每一笔（可继续进入单笔操作） */
  function openCatDetail(catId) {
    var cat = U.cat('expense', catId);
    var list = C.recordsOf(ym, 'expense').filter(function (r) { return r.categoryId === catId; });
    if (!list.length) return;

    var sum = U.sum(list, function (r) { return r.amount; });
    var total = C.summary(ym).expense;
    var pct = total > 0 ? Math.round((sum / total) * 100) : 0;

    var rows = list.slice().reverse().map(function (r) {
      return '<button class="rec" type="button" data-rec="' + U.esc(r.id) + '">' +
        '<span class="rec-ico">' + U.ico(cat.icon) + '</span>' +
        '<span class="rec-main">' +
          '<span class="rec-title">' + U.esc(r.note || cat.name) + '</span>' +
          '<span class="rec-meta">' + U.esc(U.relDay(r.date)) + ' ' + U.esc(U.weekdayCn(r.date)) + '</span>' +
        '</span>' +
        '<span class="rec-amt neg">-¥' + U.money(r.amount) + '</span>' +
      '</button>';
    }).join('');

    var s = App.ui.sheet({
      title: cat.name + ' · 共 ' + list.length + ' 笔',
      html: '<p class="act-sub">¥' + U.money(sum) + ' · 占' + (ym === U.currentYm() ? '本月' : '当月') +
        '支出 ' + pct + '%</p>' +
        '<div class="cat-detail">' + rows + '</div>'
    });

    s.body.addEventListener('click', function (e) {
      var row = e.target.closest('[data-rec]');
      if (!row) return;
      var id = row.getAttribute('data-rec');
      var rec = S.state.records.filter(function (r) { return r.id === id; })[0];
      if (!rec) return;
      s.close();
      setTimeout(function () { openRecord(rec); }, 240);   // 等面板收回去再开下一个，避免叠加
    });
  }

  /* ---------- 收支趋势（可选范围） ---------- */
  function trendBounds() {
    var r = C.recordYmRange();
    var cur = U.currentYm();
    var from = trendFrom;
    var to = trendTo;

    if (!from || !to) {
      to = cur;
      from = U.shiftYm(cur, -11);
    }
    if (from < r.min) from = r.min;
    if (to > cur) to = cur;
    if (from > to) to = from;

    return { from: from, to: to, min: r.min, max: cur };
  }

  function renderTrend() {
    var b = trendBounds();
    var months = C.monthRange(b.min, b.max);
    var data = C.trendRange(b.from, b.to);

    function options(sel) {
      return months.map(function (m) {
        return '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + U.esc(U.ymLabel(m)) + '</option>';
      }).join('');
    }

    var rangeText = b.from === b.to
      ? U.ymLabel(b.from)
      : (b.from.slice(0, 4) !== b.to.slice(0, 4)
        ? U.ymLabel(b.from) + ' - ' + U.ymLabel(b.to)
        : U.ymShort(b.from) + ' - ' + U.ymShort(b.to));

    els.trend.innerHTML =
      '<div class="card-head">' +
        '<h2>收支趋势</h2>' +
        '<span class="head-sub">' + rangeText + ' · ' + data.length + ' 个月</span>' +
      '</div>' +
      '<div class="trend-range">' +
        '<label class="tr-field"><span>从</span>' +
          '<select id="trendFrom" aria-label="起始月份">' + options(b.from) + '</select></label>' +
        '<label class="tr-field"><span>到</span>' +
          '<select id="trendTo" aria-label="结束月份">' + options(b.to) + '</select></label>' +
      '</div>' +
      '<div class="chart-box">' + App.chart.trendAreaChart(data) + '</div>' +
      '<div class="chart-legend">' +
        '<span><i style="background:#3E8E77"></i>收入</span>' +
        '<span><i style="background:#DE7A6A"></i>支出</span>' +
      '</div>';
  }

  /* ---------- 每日收支日历 ---------- */
  var WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日'];

  /* 日历格子里的紧凑金额：整数元，超过 1 万按「万」 */
  function dayMoney(fen) {
    var yuan = fen / 100;
    if (yuan >= 10000) {
      var w = yuan / 10000;
      return (w >= 10 ? Math.round(w) : Math.round(w * 10) / 10) + '万';
    }
    return String(Math.round(yuan));
  }

  /* 一次遍历聚合出每天的收入 / 支出 / 笔数 */
  function dayStats(m) {
    var map = {};
    C.recordsOf(m).forEach(function (r) {
      var d = map[r.date] || (map[r.date] = { income: 0, expense: 0, count: 0 });
      if (r.type === 'income') d.income += r.amount;
      else d.expense += r.amount;
      d.count++;
    });
    return map;
  }

  function renderCalendar() {
    var days = U.daysInYm(ym);
    var y = parseInt(ym.slice(0, 4), 10);
    var mo = parseInt(ym.slice(5, 7), 10);
    var lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7; // 周一为一周起点
    var today = U.todayStr();
    var map = dayStats(ym);

    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="cal-day is-blank"></span>';

    for (var d = 1; d <= days; d++) {
      var date = ym + '-' + U.pad2(d);
      var st = map[date];
      var cls = 'cal-day';
      if (date === today) cls += ' is-today';
      else if (date > today) cls += ' is-future';
      if (st) cls += ' has-data';

      var inner = '<span class="cal-num">' + d + '</span>';
      if (st) {
        if (st.expense) inner += '<span class="cal-val out">-' + dayMoney(st.expense) + '</span>';
        if (st.income) inner += '<span class="cal-val in">+' + dayMoney(st.income) + '</span>';
      }

      if (st) {
        cells += '<button class="' + cls + '" type="button" data-date="' + date + '" aria-label="' +
          U.esc(U.mdLabel(date) + '，支出 ¥' + U.money(st.expense) + '，收入 ¥' + U.money(st.income) +
            '，共 ' + st.count + ' 笔，点击查看明细') + '">' + inner + '</button>';
      } else {
        cells += '<span class="' + cls + '">' + inner + '</span>';
      }
    }

    els.calendar.innerHTML =
      '<div class="card cal-card">' +
        '<div class="card-head">' +
          '<h2>' + (ym === U.currentYm() ? '本月每日收支' : '当月每日收支') + '</h2>' +
          '<span class="head-sub">点有记录的日期看明细</span>' +
        '</div>' +
        '<div class="cal-week">' +
          WEEK_HEADS.map(function (w) { return '<span class="cal-wd">' + w + '</span>'; }).join('') +
        '</div>' +
        '<div class="cal-grid">' + cells + '</div>' +
      '</div>';
  }

  /* 点日历某天：当天全部流水（收入 + 支出） */
  function openDayDetail(date) {
    var list = C.recordsOf(ym).filter(function (r) { return r.date === date; });
    if (!list.length) return;

    var income = 0, expense = 0;
    list.forEach(function (r) {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    });

    var parts = [];
    if (expense) parts.push('支出 ¥' + U.money(expense));
    if (income) parts.push('收入 ¥' + U.money(income));

    var rows = list.slice().reverse().map(function (r) {
      var c = U.cat(r.type, r.categoryId);
      return '<button class="rec" type="button" data-rec="' + U.esc(r.id) + '">' +
        '<span class="rec-ico' + (r.type === 'income' ? ' income' : '') + '">' + U.ico(c.icon) + '</span>' +
        '<span class="rec-main">' +
          '<span class="rec-title">' + U.esc(r.note || c.name) + '</span>' +
          '<span class="rec-meta">' + U.esc(c.name) + '</span>' +
        '</span>' +
        '<span class="rec-amt ' + (r.type === 'income' ? 'pos' : 'neg') + '">' +
          (r.type === 'income' ? '+' : '-') + '¥' + U.money(r.amount) + '</span>' +
      '</button>';
    }).join('');

    var s = App.ui.sheet({
      title: U.mdLabel(date) + ' ' + U.weekdayCn(date) + ' · ' + list.length + ' 笔',
      html: '<p class="act-sub">' + parts.join(' · ') + '</p>' +
        '<div class="cat-detail">' + rows + '</div>'
    });

    s.body.addEventListener('click', function (e) {
      var row = e.target.closest('[data-rec]');
      if (!row) return;
      var id = row.getAttribute('data-rec');
      var rec = S.state.records.filter(function (r) { return r.id === id; })[0];
      if (!rec) return;
      s.close();
      setTimeout(function () { openRecord(rec); }, 240);   // 等面板收回去再开下一个，避免叠加
    });
  }

  /* ---------- 底部提示条（示例数据 / 备份提醒） ---------- */
  function renderTip() {
    var st = S.state;
    var html = '';

    if (st.meta.demo) {
      html += '<div class="tips">' + U.ico('i-spark') +
        '<span>现在看到的是示例数据。' +
        '<button class="link-btn" type="button" data-act="clear-demo">清空示例</button>' +
        '，就能开始记自己的账。</span></div>';
    }

    var last = st.meta.lastBackupAt ? new Date(st.meta.lastBackupAt) : null;
    var days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : -1;
    if (!st.meta.demo && !A.hasAnyData()) {
      els.tip.innerHTML = html;
      return;
    }
    if (days < 0) {
      html += '<div class="tips">' + U.ico('i-download') +
        '<span>数据只存在这台设备的浏览器里，换设备或清缓存就没了。' +
        '<button class="link-btn" type="button" data-act="export">导出备份</button></span></div>';
    } else if (days >= 7) {
      html += '<div class="tips">' + U.ico('i-download') +
        '<span>已经 ' + days + ' 天没备份了，建议' +
        '<button class="link-btn" type="button" data-act="export">导出备份</button></span></div>';
    }

    els.tip.innerHTML = html;
  }

  function syncMonth(prevYm) {
    if (ym === prevYm) ym = U.currentYm();
  }

  function resetMonth() { ym = U.currentYm(); }

  function getYm() { return ym; }

  function setYm(next) {
    var cur = U.currentYm();
    if (!U.isYm(next) || next > cur) return;
    if (next < C.recordYmRange().min) return;
    ym = next;
  }

  App.views = App.views || {};
  App.views.home = {
    init: init,
    render: render,
    syncMonth: syncMonth,
    resetMonth: resetMonth,
    getYm: getYm,
    setYm: setYm
  };
})(window.App);
