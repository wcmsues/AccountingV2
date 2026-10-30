/* =========================================================
   小账本 · 首页
   结余大卡 / 三宫格 / 预算 / 待记入 / 近 6 月柱状图 / 最近支出
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;
  var C = App.calc;
  var S = App.store;
  var A = App.actions;

  var ym = U.currentYm();
  var els = {};
  var bound = false;

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
    els.monthBar = document.getElementById('homeMonthBar');
    els.hero = document.getElementById('homeHero');
    els.stats = document.getElementById('homeStats');
    els.budget = document.getElementById('homeBudget');
    els.pending = document.getElementById('homePending');
    els.trend = document.getElementById('homeTrendCard');
    els.recent = document.getElementById('homeRecentCard');
    els.tip = document.getElementById('homeBackupTip');

    if (bound) return;
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

    els.trend.addEventListener('click', function (e) {
      var hit = e.target.closest('[data-ym]');
      if (!hit) return;
      var target = hit.getAttribute('data-ym');
      if (!target || target === ym) return;
      ym = target;
      App.refresh();
    });

    els.recent.addEventListener('click', function (e) {
      var row = e.target.closest('[data-id]');
      if (!row) return;
      var rec = S.state.records.filter(function (r) { return r.id === row.getAttribute('data-id'); })[0];
      if (rec) openRecord(rec);
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
          text: '会删掉所有示例流水和存钱记录，然后从零开始。',
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
            App.switchTab('ledger');
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
    renderMonthBar();
    renderEmptyGuide();
    renderHero(sum);
    renderStats(sum);
    renderBudget();
    renderPending();
    renderTrend();
    renderRecent();
    renderTip();
  }

  function renderMonthBar() {
    App.ui.monthBar(els.monthBar, ym, function (d) {
      ym = U.shiftYm(ym, d);
      App.refresh();
    });
  }

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

  function renderStats(sum) {
    var prevYm = U.shiftYm(ym, -1);
    var bal = C.savingsBalanceAt(ym);
    var delta = bal - C.savingsBalanceAt(prevYm);

    function cell(label, icon, value, sub, cls) {
      return '<div class="stat ' + (cls || '') + '">' +
        '<div class="st-label">' + U.ico(icon) + label + '</div>' +
        '<div class="st-val" title="¥' + U.money(value) + '">' + U.moneyShort(value) + '</div>' +
        '<div class="st-sub">' + sub + '</div>' +
      '</div>';
    }

    els.stats.innerHTML =
      cell('收入', 'i-download', sum.income,
        sum.income ? (ym === U.currentYm() ? '本月进账' : '当月进账') : '还没记收入', 'income') +
      cell('支出', 'i-upload', sum.expense, sum.expCount ? sum.expCount + ' 笔开销' : '还没记支出', 'expense') +
      cell('存款', 'i-piggy', bal,
        delta === 0 ? '和上月持平' : (delta > 0 ? '比上月 +' : '比上月 -') + '¥' + U.money(Math.abs(delta)),
        'net');
  }

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

  function renderTrend() {
    var data = C.trend(ym, 6);
    els.trend.innerHTML =
      '<div class="card-head">' +
        '<h2>近 6 个月收支</h2>' +
        '<span class="head-sub">点柱子切换月份</span>' +
      '</div>' +
      '<div class="chart-box">' + App.chart.barChart(data, { activeYm: ym }) + '</div>' +
      '<div class="chart-legend">' +
        '<span><i style="background:#8FD0B8"></i>收入</span>' +
        '<span><i style="background:#F3B3A2"></i>支出</span>' +
      '</div>';
  }

  function renderRecent() {
    var list = C.recordsOf(ym, 'expense').slice(-5).reverse();

    var body;
    if (!list.length) {
      body = '<div class="empty">这个月还没有支出，清清爽爽。</div>';
    } else {
      body = list.map(function (r) {
        var c = U.cat('expense', r.categoryId);
        return '<button class="rec" type="button" data-id="' + U.esc(r.id) + '">' +
          '<span class="rec-ico">' + U.ico(c.icon) + '</span>' +
          '<span class="rec-main">' +
            '<span class="rec-title">' + U.esc(r.note || c.name) + '</span>' +
            '<span class="rec-meta">' + U.esc(c.name) + ' · ' + U.esc(U.relDay(r.date)) + '</span>' +
          '</span>' +
          '<span class="rec-amt neg">-¥' + U.money(r.amount) + '</span>' +
        '</button>';
      }).join('');
    }

    els.recent.innerHTML = '<div class="card-head"><h2>最近 5 笔支出</h2></div>' + body;
  }

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

  App.views = App.views || {};
  App.views.home = {
    init: init,
    render: render,
    syncMonth: syncMonth,
    resetMonth: resetMonth,
    getYm: getYm
  };
})(window.App);
