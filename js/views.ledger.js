/* =========================================================
   小账本 · 记账页
   支出/收入分段 · 金额 · 分类九宫格 · 固定收支 · 本月明细
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;
  var C = App.calc;
  var S = App.store;
  var A = App.actions;

  var mode = 'expense';
  var catId = 'food';
  var editingId = null;
  var locked = false;
  var fixedOpen = false;
  var bound = false;
  var els = {};

  function init() {
    els.form = document.getElementById('entryCard');
    els.seg = document.getElementById('entryTypeSeg');
    els.amount = document.getElementById('amountInput');
    els.catGrid = document.getElementById('catGrid');
    els.note = document.getElementById('noteInput');
    els.date = document.getElementById('dateInput');
    els.save = document.getElementById('saveBtn');
    els.cancel = document.getElementById('cancelEditBtn');
    els.stats = document.getElementById('ledgerStats');
    els.fixed = document.getElementById('fixedCard');
    els.detail = document.getElementById('detailCard');

    if (!els.date.value) els.date.value = U.todayStr();

    if (bound) return;
    bound = true;

    App.ui.bindAmountInput(els.amount);

    els.amount.addEventListener('input', updateSaveState);

    els.seg.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-type]');
      if (!btn) return;
      var t = btn.getAttribute('data-type');
      if (t === mode) return;
      mode = t;
      catId = U.cats(mode)[0].id;
      renderCats();
      updateSaveState();
    });

    els.catGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (!btn) return;
      catId = btn.getAttribute('data-cat');
      renderCats();
    });

    els.form.addEventListener('submit', onSubmit);
    els.cancel.addEventListener('click', function () {
      exitEdit();
      els.amount.value = '';
      els.note.value = '';
      updateSaveState();
    });

    els.fixed.addEventListener('click', function (e) {
      if (e.target.closest('[data-add-fixed]')) {
        openFixedForm(null);
        return;
      }
      var row = e.target.closest('[data-fix]');
      if (!row) return;
      openFixedActions(row.getAttribute('data-fix'));
    });

    els.fixed.addEventListener('toggle', function (e) {
      if (e.target && e.target.matches('details.fold')) fixedOpen = e.target.open;
    }, true);

    els.detail.addEventListener('click', function (e) {
      var row = e.target.closest('[data-id]');
      if (!row) return;
      var rec = findRecord(row.getAttribute('data-id'));
      if (rec) openRecord(rec);
    });

    renderCats();
    updateSaveState();
  }

  function findRecord(id) {
    var list = S.state.records;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------- 表单 ---------- */
  function renderCats() {
    var list = U.cats(mode);
    var has = list.some(function (c) { return c.id === catId; });
    if (!has) catId = list[0].id;

    els.catGrid.innerHTML = list.map(function (c) {
      return '<button class="cat' + (c.id === catId ? ' is-active' : '') + '" type="button" data-cat="' + c.id + '">' +
        '<span class="cat-ico">' + U.ico(c.icon) + '</span>' +
        '<span class="cat-name">' + U.esc(c.name) + '</span>' +
      '</button>';
    }).join('');

    els.seg.querySelectorAll('[data-type]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-type') === mode);
    });
    els.form.classList.toggle('mode-income', mode === 'income');

    els.save.textContent = editingId ? '保存修改' : (mode === 'income' ? '记这笔收入' : '保存这笔');
    els.cancel.hidden = !editingId;
  }

  function updateSaveState() {
    els.save.disabled = locked || !U.parseAmount(els.amount.value);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (locked) return;

    var amount = U.parseAmount(els.amount.value);
    if (!amount) {
      App.ui.toast('先填一个有效的金额');
      els.amount.focus();
      return;
    }
    var date = U.isDate(els.date.value) ? els.date.value : U.todayStr();
    var note = els.note.value.trim();

    locked = true;
    updateSaveState();

    try {
      if (editingId) {
        A.updateRecord(editingId, { type: mode, amount: amount, categoryId: catId, date: date, note: note });
        App.ui.toast('已更新');
        exitEdit();
        els.amount.value = '';
        els.note.value = '';
      } else {
        A.addRecord({ type: mode, amount: amount, categoryId: catId, date: date, note: note });
        App.ui.toast('记好了 · ' + (mode === 'income' ? '+' : '-') + '¥' + U.money(amount));
        els.amount.value = '';
        els.note.value = '';
      }
      els.amount.blur();
      if (U.ymOf(date) !== U.currentYm()) {
        App.ui.toast('已记入 ' + U.ymLabel(U.ymOf(date)));
      }
    } finally {
      setTimeout(function () {
        locked = false;
        updateSaveState();
      }, 320);
    }

    App.refreshAll();
  }

  function exitEdit() {
    editingId = null;
    els.cancel.hidden = true;
    els.save.textContent = mode === 'income' ? '记这笔收入' : '保存这笔';
    renderCats();
  }

  function editRecord(id) {
    var rec = findRecord(id);
    if (!rec) return;
    editingId = rec.id;
    mode = rec.type;
    catId = rec.categoryId;
    els.amount.value = U.yuanInput(rec.amount);
    els.note.value = rec.note || '';
    els.date.value = rec.date;
    renderCats();
    updateSaveState();
    setTimeout(function () {
      els.amount.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 120);
  }

  function openRecord(rec) {
    var c = U.cat(rec.type, rec.categoryId);
    var sub = U.mdLabel(rec.date) + ' ' + U.weekdayCn(rec.date) + ' · ' + c.name +
      (rec.note ? ' · ' + rec.note : '') + (rec.source === 'fixed' ? ' · 固定收支生成' : '');

    App.ui.actionSheet(
      (rec.type === 'income' ? '+' : '-') + '¥' + U.money(rec.amount),
      sub,
      [
        { label: '编辑这笔', icon: 'i-edit', onClick: function () { editRecord(rec.id); } },
        {
          label: '删除这笔', icon: 'i-trash', danger: true,
          onClick: function () {
            App.ui.confirm({
              title: '删除这笔记录？',
              text: rec.source === 'fixed' ? '删除后本月不会再自动补回来；想找回可以点「补记」。' : '删除后可以撤销。',
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

  /* ---------- 渲染 ---------- */
  function render() {
    if (!els.form) init();
    renderStats();
    renderFixed();
    renderDetail();
    updateSaveState();
  }

  function renderStats() {
    var ym = U.currentYm();
    var s = C.summary(ym);
    var cells = [
      { label: '收入', val: s.income, sub: '本月进账', cls: 'income', icon: 'i-download' },
      { label: '支出', val: s.expense, sub: s.expCount + ' 笔开销', cls: 'expense', icon: 'i-upload' },
      { label: '结余', val: s.net, sub: s.net >= 0 ? '存下的' : '超支了', cls: s.net >= 0 ? 'net' : 'expense', icon: 'i-wallet' },
      { label: '笔数', val: s.count, sub: '条记录', cls: '', icon: 'i-ledger', raw: true }
    ];

    els.stats.innerHTML = cells.map(function (c) {
      return '<div class="stat ' + c.cls + '">' +
        '<div class="st-label">' + U.ico(c.icon) + c.label + '</div>' +
        '<div class="st-val" title="' + (c.raw ? c.val + ' 笔' : '¥' + U.money(c.val)) + '">' +
          (c.raw ? c.val : U.moneyShort(c.val)) + '</div>' +
        '<div class="st-sub">' + c.sub + '</div>' +
      '</div>';
    }).join('');
  }

  function renderFixed() {
    var ym = U.currentYm();
    var list = C.fixedStatus(ym);
    var todayDay = parseInt(U.todayStr().slice(8, 10), 10);

    var rows = list.map(function (x) {
      var it = x.item;
      var pill;
      if (!it.enabled) pill = '<span class="pill off">已停用</span>';
      else if (x.posted) pill = '<span class="pill ok">本月已记</span>';
      else if (x.suppressed) pill = '<span class="pill off">已跳过</span>';
      else if (it.day <= todayDay) pill = '<span class="pill due">待记入</span>';
      else pill = '<span class="pill">' + it.day + ' 号</span>';

      var c = U.cat(it.type, it.categoryId);
      return '<button class="fix-row" type="button" data-fix="' + U.esc(it.id) + '">' +
        '<span class="rec-ico' + (it.type === 'income' ? ' income' : '') + '">' + U.ico(c.icon) + '</span>' +
        '<span class="rec-main">' +
          '<span class="rec-title">' + U.esc(it.name) + '</span>' +
          '<span class="rec-meta">每月 ' + it.day + ' 号 · ¥' + U.money(it.amount) + ' · ' + U.esc(c.name) + '</span>' +
        '</span>' + pill +
      '</button>';
    }).join('');

    els.fixed.innerHTML =
      '<details class="fold"' + (fixedOpen ? ' open' : '') + '>' +
        '<summary>' + U.ico('i-clock') + '固定收支' +
          '<span class="count-badge">' + list.length + '</span>' +
          '<span class="chev">' + U.ico('i-chev-down') + '</span>' +
        '</summary>' +
        '<div class="fold-body">' +
          (rows || '<div class="empty">把房租、工资这类每月固定的账设一次，之后自动记。</div>') +
          '<button class="btn block add-fix" type="button" data-add-fixed>' + U.ico('i-plus') + '新增固定收支</button>' +
        '</div>' +
      '</details>';
  }

  function renderDetail() {
    var ym = U.currentYm();
    var sum = C.summary(ym);
    var groups = C.groupByDay(C.recordsOf(ym));

    var body;
    if (!groups.length) {
      body = '<div class="empty">这个月还没有记录，上面记一笔试试。</div>';
    } else {
      body = groups.map(function (g) {
        var parts = [];
        if (g.expense) parts.push('支出 ¥' + U.money(g.expense));
        if (g.income) parts.push('收入 ¥' + U.money(g.income));

        var rows = g.items.map(function (r) {
          var c = U.cat(r.type, r.categoryId);
          return '<button class="rec" type="button" data-id="' + U.esc(r.id) + '">' +
            '<span class="rec-ico' + (r.type === 'income' ? ' income' : '') + '">' + U.ico(c.icon) + '</span>' +
            '<span class="rec-main">' +
              '<span class="rec-title">' + U.esc(r.note || c.name) +
                (r.source === 'fixed' ? '<em class="tag">固定</em>' : '') + '</span>' +
              '<span class="rec-meta">' + U.esc(c.name) + '</span>' +
            '</span>' +
            '<span class="rec-amt ' + (r.type === 'income' ? 'pos' : 'neg') + '">' +
              (r.type === 'income' ? '+' : '-') + '¥' + U.money(r.amount) + '</span>' +
          '</button>';
        }).join('');

        return '<div class="day-head"><span>' + U.mdLabel(g.date) + ' ' + U.weekdayCn(g.date) + '</span>' +
          '<span>' + parts.join(' · ') + '</span></div>' + rows;
      }).join('');
    }

    els.detail.innerHTML =
      '<div class="card-head">' +
        '<h2>本月明细</h2>' +
        '<span class="head-sub">' + sum.count + ' 笔 · 支出 ¥' + U.money(sum.expense) + '</span>' +
      '</div>' + body;
  }

  /* ---------- 固定收支操作 ---------- */
  function openFixedActions(id) {
    var ym = U.currentYm();
    var it = S.state.fixedItems.filter(function (x) { return x.id === id; })[0];
    if (!it) return;

    var posted = C.fixedRecord(id, ym);
    var actions = [
      {
        label: '编辑', icon: 'i-edit',
        onClick: function () { openFixedForm(it); }
      },
      posted
        ? {
            label: '撤销本月记录', icon: 'i-undo',
            onClick: function () {
              var rec = C.fixedRecord(id, ym);
              A.undoFixed(id, ym);
              App.refreshAll();
              App.ui.toast('已撤销本月记录', {
                actionLabel: '撤销',
                onAction: function () { A.restoreRecord(rec); App.refreshAll(); }
              });
            }
          }
        : {
            label: '补记本月', icon: 'i-refresh',
            onClick: function () {
              A.postFixed(id, ym);
              App.refreshAll();
              App.ui.toast('已补记「' + it.name + '」');
            }
          },
      {
        label: it.enabled ? '停用' : '启用', icon: it.enabled ? 'i-pause' : 'i-play',
        onClick: function () {
          A.toggleFixed(id);
          App.refreshAll();
          App.ui.toast(it.enabled ? '已停用' : '已启用');
        }
      },
      {
        label: '删除', icon: 'i-trash', danger: true,
        onClick: function () {
          App.ui.confirm({
            title: '删除「' + it.name + '」？',
            text: '已经生成的历史账目会保留。',
            okText: '删除',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            A.deleteFixed(id);
            App.refreshAll();
            App.ui.toast('已删除');
          });
        }
      }
    ];

    App.ui.actionSheet(it.name + ' · ¥' + U.money(it.amount) + ' / 月',
      '每月 ' + it.day + ' 号自动记入' + (it.enabled ? '' : '（已停用）'), actions);
  }

  function openFixedForm(item) {
    var isNew = !item;
    var it = item || { type: 'expense', name: '', amount: 0, categoryId: 'home', day: 1 };
    var typeState = it.type;

    function catOptions(type, selected) {
      return U.cats(type).map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' + U.esc(c.name) + '</option>';
      }).join('');
    }

    var html =
      '<div class="field"><label>名称</label>' +
        '<input id="fxName" type="text" maxlength="12" autocomplete="off" placeholder="房租 / 工资 / 会员费…" value="' + U.esc(it.name) + '">' +
      '</div>' +
      '<div class="field"><label>类型</label>' +
        '<div class="seg" id="fxTypeSeg">' +
          '<button class="seg-item' + (typeState === 'expense' ? ' is-active' : '') + '" type="button" data-type="expense">支出</button>' +
          '<button class="seg-item' + (typeState === 'income' ? ' is-active' : '') + '" type="button" data-type="income">收入</button>' +
        '</div>' +
      '</div>' +
      '<div class="field"><label>金额</label>' +
        '<div class="inp-wrap has-pre"><span class="pre">¥</span>' +
        '<input id="fxAmount" type="text" inputmode="decimal" maxlength="12" placeholder="0.00" value="' + (it.amount ? U.yuanInput(it.amount) : '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>分类</label><select id="fxCat">' + catOptions(typeState, it.categoryId) + '</select></div>' +
      '<div class="field"><label>每月几号</label>' +
        '<input id="fxDay" type="number" min="1" max="31" inputmode="numeric" value="' + it.day + '">' +
        '<p class="hint">超过当月天数按月末记；只补已到期的月份。</p>' +
      '</div>' +
      '<button class="btn primary block" type="button" id="fxSave">' + (isNew ? '保存固定收支' : '保存修改') + '</button>';

    var s = App.ui.sheet({ title: isNew ? '新增固定收支' : '编辑固定收支', html: html });

    var catSel = s.body.querySelector('#fxCat');
    var amountInp = s.body.querySelector('#fxAmount');
    App.ui.bindAmountInput(amountInp);

    s.body.querySelectorAll('#fxTypeSeg [data-type]').forEach(function (btn) {
      btn.onclick = function () {
        typeState = btn.getAttribute('data-type');
        s.body.querySelectorAll('#fxTypeSeg [data-type]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        catSel.innerHTML = catOptions(typeState, U.cats(typeState)[0].id);
      };
    });

    s.body.querySelector('#fxSave').onclick = function () {
      var name = s.body.querySelector('#fxName').value.trim();
      var amount = U.parseAmount(amountInp.value);
      var day = U.clamp(Math.round(Number(s.body.querySelector('#fxDay').value)) || 1, 1, 31);

      if (!name) { App.ui.toast('给它起个名字'); return; }
      if (!amount) { App.ui.toast('金额要大于 0'); amountInp.focus(); return; }

      var payload = { name: name, type: typeState, amount: amount, categoryId: catSel.value, day: day };
      if (isNew) A.addFixed(payload);
      else A.updateFixed(item.id, payload);

      s.close();
      App.refreshAll();
      App.ui.toast(isNew ? '固定收支已添加' : '已保存');
    };

    setTimeout(function () { s.body.querySelector('#fxName').focus(); }, 260);
  }

  App.views = App.views || {};
  App.views.ledger = {
    init: init,
    render: render,
    editRecord: editRecord
  };
})(window.App);
