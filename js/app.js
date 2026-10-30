/* =========================================================
   小账本 · 入口
   Tab 路由 / 刷新调度 / 设置面板 / 备份 / 自动补记心跳
   ========================================================= */
(function (App) {
  'use strict';

  var U = App.util;
  var C = App.calc;
  var ST = App.store;
  var A = App.actions;

  var current = 'home';
  var scrollPos = { home: 0, ledger: 0 };
  var lastYm = U.currentYm();
  var els = {};
  var booted = false;

  /* ---------- 启动 ---------- */
  function cacheEls() {
    els.title = document.getElementById('pageTitle');
    els.monthBtn = document.getElementById('monthPickBtn');
    els.monthTxt = document.getElementById('monthPickTxt');
    els.ledgerMonthBtn = document.getElementById('ledgerMonthPickBtn');
    els.ledgerMonthTxt = document.getElementById('ledgerMonthPickTxt');
  }

  function boot() {
    cacheEls();
    if (booted) return;
    booted = true;

    // Netlify 免费版会在右下角注入徽标，这里给页面底部多留一点空间
    if (/(^|\.)netlify\.app$/i.test(location.hostname)) {
      document.body.classList.add('is-netlify');
    }

    ST.load();

    App.views.home.init();
    App.views.ledger.init();

    bindTabs();
    bindMonthPick();
    bindSettings();

    A.autoPostFixed();
    refreshAll();
    showWarnings();

    setInterval(tick, 60000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') tick();
    });
  }

  /* 跨零点 / 跨月 / 挂机：重新补记并刷新 */
  function tick() {
    var added = A.autoPostFixed();
    var cur = U.currentYm();
    var monthChanged = cur !== lastYm;
    if (monthChanged) {
      App.views.home.syncMonth(lastYm);
      App.views.ledger.syncMonth(lastYm);
      lastYm = cur;
    }
    if (added) {
      refreshAll();
      App.ui.toast('固定收支已自动记入');
    } else if (monthChanged) {
      refreshAll();
    }
    showWarnings();
  }

  /* ---------- Tab ---------- */
  function bindTabs() {
    var bar = document.getElementById('tabbar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });
  }

  /* 月份下拉日历：首页与记账页各一个，行为一致 */
  function bindMonthPick() {
    var picks = [
      { btn: els.monthBtn, view: App.views.home },
      { btn: els.ledgerMonthBtn, view: App.views.ledger }
    ];

    picks.forEach(function (p) {
      if (!p.btn || !p.view) return;
      p.btn.addEventListener('click', function () {
        var r = C.recordYmRange();
        p.btn.classList.add('is-open');
        App.ui.monthPopover(p.btn, {
          ym: p.view.getYm(),
          min: r.min,
          max: U.currentYm(),
          onClose: function () { p.btn.classList.remove('is-open'); },
          onChange: function (target) {
            p.view.setYm(target);
            App.refresh();
          }
        });
      });
    });
  }

  function switchTab(tab) {
    if (!tab) return;
    var page = document.querySelector('.page[data-page="' + tab + '"]');
    if (!page || (tab !== 'home' && tab !== 'ledger')) return;

    if (tab !== current) {
      scrollPos[current] = window.scrollY || 0;
      current = tab;
    }

    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-page') === tab);
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === tab);
    });

    App.refresh();
    requestAnimationFrame(function () {
      window.scrollTo(0, scrollPos[tab] || 0);
      repaintDateInputs();
    });
  }

  /* iOS 上在元素隐藏（display:none）时写入的日期值可能不渲染，
     切回页面后重写一次，强制重绘日期文本 */
  function repaintDateInputs() {
    ['dateInput'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.value || document.activeElement === el) return;
      var v = el.value;
      el.value = '';
      el.value = v;
    });
  }

  /* ---------- 刷新 ---------- */
  function updateAppbar() {
    if (!els.title || !els.monthBtn || !els.monthTxt) return;

    els.title.textContent = current === 'home' ? '首页' : '记账';

    els.monthTxt.textContent = U.ymLabel(App.views.home.getYm());
    if (els.ledgerMonthTxt) els.ledgerMonthTxt.textContent = U.ymLabel(App.views.ledger.getYm());
  }

  function refresh() {
    if (current === 'home') App.views.home.render();
    else App.views.ledger.render();

    updateAppbar();
    showWarnings();
  }

  function refreshAll() {
    App.views.home.render();
    App.views.ledger.render();
    updateAppbar();
    showWarnings();
  }

  /* ---------- 提示条 ---------- */
  function showWarnings() {
    var bar = document.getElementById('warnBar');
    if (!bar) return;

    var f = ST.flags;
    var msgs = [];

    if (f.memory) {
      msgs.push('浏览器不允许本地存储（可能是无痕模式）：本次数据只保存在内存里，关掉页面就没了，请先导出备份。');
    }
    if (f.versionHigh) {
      msgs.push('本地数据来自更新版本，已忽略。请更新页面后再打开，避免覆盖旧数据。');
    }
    if (f.restored && !f.versionHigh) {
      msgs.push('原数据读取失败，已从上次快照恢复。');
    }
    if (f.badData && !f.restored && !f.versionHigh) {
      msgs.push('本地数据格式异常，已重置为空白账本；如果有备份可以导入找回。');
    }
    if (f.quota) {
      msgs.push('存储空间不足，最新的改动可能没保存成功，请先导出备份。');
    }

    if (!msgs.length) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }
    bar.innerHTML = msgs.map(function (m) { return '<p>' + U.esc(m) + '</p>'; }).join('');
    bar.hidden = false;
  }

  /* ---------- 设置 ---------- */
  function bindSettings() {
    var btn = document.getElementById('settingsBtn');
    if (btn) btn.addEventListener('click', openSettings);
  }

  function autoBtn(value, label, cur) {
    return '<button class="seg-item' + (cur === value ? ' is-active' : '') +
      '" type="button" data-auto="' + value + '">' + label + '</button>';
  }

  function openSettings() {
    var s = ST.state;
    var set = s.settings;
    var last = s.meta.lastBackupAt ? new Date(s.meta.lastBackupAt) : null;
    var lastText = last ? (U.relDay(U.dateStr(last)) + ' ' + U.pad2(last.getHours()) + ':' + U.pad2(last.getMinutes())) : '从未备份';

    var html =
      '<div class="set-group">' +
        '<h4>' + U.ico('i-wallet') + '基础设置</h4>' +
        '<div class="field"><label>每月支出预算（元）</label>' +
          '<div class="inp-wrap has-pre"><span class="pre">¥</span>' +
            '<input id="setBudget" type="number" min="0" step="1" inputmode="decimal" placeholder="留空或 0 表示不启用" value="' +
              (set.monthlyBudget ? (set.monthlyBudget / 100) : '') + '"></div>' +
          '<p class="hint">只统计支出，不启用就留空。</p>' +
        '</div>' +
      '</div>' +
      '<div class="set-group">' +
        '<h4>' + U.ico('i-clock') + '固定收支</h4>' +
        '<div class="field"><label>自动入账</label>' +
          '<div class="seg" id="setAuto">' +
            autoBtn('due', '到期自动', set.autoPostFixed) +
            autoBtn('monthStart', '月初全记', set.autoPostFixed) +
            autoBtn('off', '仅手动', set.autoPostFixed) +
          '</div>' +
          '<p class="hint">到期自动：每月设定的日子到了才记；月初全记：每月 1 号一次记上当月全部。</p>' +
        '</div>' +
      '</div>' +
      '<div class="set-group">' +
        '<h4>' + U.ico('i-download') + '数据备份</h4>' +
        '<div class="set-actions">' +
          '<button class="btn block" type="button" data-set="export">' + U.ico('i-download') + '导出备份（JSON）</button>' +
          '<button class="btn block" type="button" data-set="import">' + U.ico('i-upload') + '导入备份</button>' +
          '<button class="btn block" type="button" data-set="restore"' + (ST.hasSnapshot() ? '' : ' disabled') + '>' +
            U.ico('i-undo') + '恢复导入前快照</button>' +
        '</div>' +
        '<p class="hint">导入前会自动留一份快照，手滑也能找回。</p>' +
      '</div>' +
      '<div class="set-group">' +
        '<h4>' + U.ico('i-alert') + '危险操作</h4>' +
        '<button class="btn block warn" type="button" data-set="clear">清空全部数据</button>' +
      '</div>' +
      '<p class="meta-info">存储占用 ' + U.bytes(ST.sizeBytes()) + ' · 上次备份 ' + U.esc(lastText) + '</p>';

    var sheet = App.ui.sheet({ title: '设置', html: html });
    var body = sheet.body;

    var budgetInp = body.querySelector('#setBudget');

    budgetInp.addEventListener('change', function () {
      var v = Number(budgetInp.value);
      A.setSetting('monthlyBudget', isFinite(v) ? Math.round(v * 100) : 0);
      budgetInp.value = ST.state.settings.monthlyBudget ? (ST.state.settings.monthlyBudget / 100) : '';
      refreshAll();
    });

    body.querySelectorAll('[data-auto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-auto');
        if (v === ST.state.settings.autoPostFixed) return;
        A.setSetting('autoPostFixed', v);
        body.querySelectorAll('[data-auto]').forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-auto') === v);
        });
        if (v !== 'off') {
          var n = A.autoPostFixed();
          if (n) App.ui.toast('补记了 ' + n + ' 笔');
        }
        refreshAll();
      });
    });

    body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-set]');
      if (!btn) return;
      var act = btn.getAttribute('data-set');

      if (act === 'export') {
        exportBackup();
      } else if (act === 'import') {
        sheet.close();
        importBackup();
      } else if (act === 'restore') {
        if (!ST.hasSnapshot()) return;
        App.ui.confirm({
          title: '恢复到导入前的数据？',
          text: '当前数据会被替换（现在的这份也会留成新快照，可再换回来）。',
          okText: '恢复'
        }).then(function (ok) {
          if (!ok) return;
          if (!ST.restoreSnapshot()) { App.ui.toast('没有可恢复的快照'); return; }
          sheet.close();
          refreshAll();
          App.ui.toast('已恢复到导入前的数据');
        });
      } else if (act === 'clear') {
        sheet.close();
        App.ui.confirmType({
          title: '清空全部数据？',
          text: '所有收支、固定收支和设置都会删除，无法撤销。建议先导出备份。',
          expect: '删除'
        }).then(function (ok) {
          if (!ok) return;
          ST.clearAll();
          App.views.home.resetMonth();
          App.views.ledger.resetMonth();
          refreshAll();
          App.ui.toast('已清空');
        });
      }
    });
  }

  /* ---------- 备份 ---------- */
  function exportBackup() {
    var data = ST.exportJSON();
    var filename = '小账本备份_' + U.todayStr() + '.json';

    try {
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1200);
    } catch (e) {
      var a2 = document.createElement('a');
      a2.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
      a2.download = filename;
      a2.click();
    }

    ST.markBackedUp();
    refreshAll();
    App.ui.toast('备份已导出');
  }

  function importBackup() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    document.body.appendChild(inp);

    inp.onchange = function () {
      var file = inp.files && inp.files[0];
      if (!file) { inp.remove(); return; }

      var reader = new FileReader();
      reader.onload = function () {
        inp.remove();
        App.ui.confirm({
          title: '导入这份备份？',
          text: '当前数据会被替换，系统会先自动留一份快照。',
          okText: '导入'
        }).then(function (ok) {
          if (!ok) return;
          var r = ST.importJSON(String(reader.result || ''));
          if (!r.ok) { App.ui.toast(r.error || '导入失败'); return; }
          App.views.home.resetMonth();
          App.views.ledger.resetMonth();
          refreshAll();
          App.ui.toast('导入完成');
        });
      };
      reader.onerror = function () {
        inp.remove();
        App.ui.toast('这个文件读不出来');
      };
      reader.readAsText(file);
    };

    inp.click();
  }

  /* ---------- 对外 ---------- */
  App.refresh = refresh;
  App.refreshAll = refreshAll;
  App.switchTab = switchTab;
  App.exportBackup = exportBackup;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.App);
