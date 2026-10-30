/* =========================================================
   小账本 · 交互组件
   toast / 确认框 / 底部面板 / 月份条 / 金额输入
   ========================================================= */
window.App = window.App || {};
(function (App) {
  'use strict';

  var U = App.util;

  function layer() {
    var l = document.getElementById('layerRoot');
    if (!l) {
      l = document.createElement('div');
      l.id = 'layerRoot';
      document.body.appendChild(l);
    }
    return l;
  }

  function bodyLock(on) {
    document.body.classList[on ? 'add' : 'remove']('is-locked');
  }

  /* ---------- toast ---------- */
  var toastEl = null;
  var toastTimer = null;

  function hideToast() {
    if (toastEl) toastEl.classList.remove('is-show');
  }

  function toast(msg, opts) {
    opts = opts || {};
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      layer().appendChild(toastEl);
    }
    var html = '<span class="toast-txt">' + U.esc(msg) + '</span>';
    if (opts.actionLabel) {
      html += '<button class="toast-act" type="button">' + U.esc(opts.actionLabel) + '</button>';
    }
    toastEl.innerHTML = html;
    toastEl.classList.add('is-show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.actionLabel ? 5000 : 2400);

    var btn = toastEl.querySelector('.toast-act');
    if (btn) {
      btn.onclick = function () {
        hideToast();
        if (opts.onAction) opts.onAction();
      };
    }
  }

  /* ---------- 确认框 ---------- */
  function dialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'dlg-mask';
      mask.innerHTML =
        '<div class="dlg" role="dialog" aria-modal="true">' +
          '<h3>' + U.esc(opts.title || '确认') + '</h3>' +
          (opts.text ? '<p>' + U.esc(opts.text).replace(/\n/g, '<br>') + '</p>' : '') +
          '<div class="dlg-actions">' +
            '<button class="btn" type="button" data-cancel>' + U.esc(opts.cancelText || '取消') + '</button>' +
            '<button class="btn ' + (opts.danger ? 'warn' : 'primary') + '" type="button" data-ok>' +
              U.esc(opts.okText || '确定') + '</button>' +
          '</div>' +
        '</div>';
      layer().appendChild(mask);
      bodyLock(true);
      requestAnimationFrame(function () { mask.classList.add('is-open'); });

      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        mask.classList.remove('is-open');
        bodyLock(false);
        document.removeEventListener('keydown', onKey);
        setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 200);
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') finish(false); }
      document.addEventListener('keydown', onKey);
      mask.querySelector('[data-ok]').onclick = function () { finish(true); };
      mask.querySelector('[data-cancel]').onclick = function () { finish(false); };
      mask.addEventListener('click', function (e) { if (e.target === mask) finish(false); });
    });
  }

  /* 需要输入指定文字才能确认（清空数据） */
  function confirmType(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var expect = opts.expect || '删除';
      var mask = document.createElement('div');
      mask.className = 'dlg-mask';
      mask.innerHTML =
        '<div class="dlg" role="dialog" aria-modal="true">' +
          '<h3>' + U.esc(opts.title || '确认操作') + '</h3>' +
          '<p>' + U.esc(opts.text || '') + '</p>' +
          '<div class="field" style="margin-top:12px">' +
            '<label>请输入「' + U.esc(expect) + '」以继续</label>' +
            '<input type="text" id="confirmTypeInp" autocomplete="off" placeholder="' + U.esc(expect) + '">' +
          '</div>' +
          '<div class="dlg-actions">' +
            '<button class="btn" type="button" data-cancel>取消</button>' +
            '<button class="btn warn" type="button" data-ok disabled>确认清空</button>' +
          '</div>' +
        '</div>';
      layer().appendChild(mask);
      bodyLock(true);
      requestAnimationFrame(function () { mask.classList.add('is-open'); });

      var inp = mask.querySelector('#confirmTypeInp');
      var ok = mask.querySelector('[data-ok]');
      inp.oninput = function () { ok.disabled = inp.value.trim() !== expect; };

      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        mask.classList.remove('is-open');
        bodyLock(false);
        document.removeEventListener('keydown', onKey);
        setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 200);
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') finish(false); }
      document.addEventListener('keydown', onKey);
      ok.onclick = function () { finish(true); };
      mask.querySelector('[data-cancel]').onclick = function () { finish(false); };
      mask.addEventListener('click', function (e) { if (e.target === mask) finish(false); });
      setTimeout(function () { inp.focus(); }, 260);
    });
  }

  /* ---------- 底部面板 ---------- */
  function sheet(opts) {
    opts = opts || {};
    var mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true">' +
        '<div class="sheet-grip"></div>' +
        '<div class="sheet-head"><h3>' + U.esc(opts.title || '') + '</h3>' +
          '<button class="icon-btn sheet-x" type="button" aria-label="关闭">' + U.ico('i-close') + '</button>' +
        '</div>' +
        '<div class="sheet-body">' + (opts.html || '') + '</div>' +
      '</div>';
    layer().appendChild(mask);
    bodyLock(true);
    requestAnimationFrame(function () { mask.classList.add('is-open'); });

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      mask.classList.remove('is-open');
      bodyLock(false);
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 280);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    mask.querySelector('.sheet-x').onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    if (opts.onMount) opts.onMount(mask.querySelector('.sheet-body'), close);

    return { mask: mask, body: mask.querySelector('.sheet-body'), close: close };
  }

  function actionSheet(title, sub, actions) {
    var html = (sub ? '<p class="act-sub">' + U.esc(sub) + '</p>' : '') +
      '<div class="sheet-actions">' +
      actions.map(function (a, i) {
        return '<button class="act' + (a.danger ? ' danger' : '') + '" type="button" data-i="' + i + '">' +
          (a.icon ? U.ico(a.icon) : '') + '<span>' + U.esc(a.label) + '</span></button>';
      }).join('') + '</div>';

    var s = sheet({ title: title, html: html });
    s.body.querySelectorAll('.act').forEach(function (btn) {
      btn.onclick = function () {
        var a = actions[parseInt(btn.getAttribute('data-i'), 10)];
        s.close();
        if (a && a.onClick) setTimeout(a.onClick, 80);
      };
    });
    return s;
  }

  /* ---------- 月份条 ---------- */
  function monthBar(el, ym, onChange) {
    if (!el) return;
    var cur = U.currentYm();
    el.innerHTML =
      '<button class="mb-btn" type="button" data-d="-1" aria-label="上个月">' + U.ico('i-chev-left') + '</button>' +
      '<div class="mb-label">' + U.esc(U.ymLabel(ym)) +
        (ym === cur ? '<span class="mb-now">本月</span>' : '') + '</div>' +
      '<button class="mb-btn" type="button" data-d="1" aria-label="下个月"' + (ym >= cur ? ' disabled' : '') + '>' +
        U.ico('i-chev-right') + '</button>';
    el.querySelectorAll('[data-d]').forEach(function (btn) {
      btn.onclick = function () { onChange(parseInt(btn.getAttribute('data-d'), 10)); };
    });
  }

  /* ---------- 金额输入 ---------- */
  function bindAmountInput(inp) {
    if (!inp) return;
    inp.addEventListener('input', function () {
      var v = this.value;
      var c = U.cleanAmount(v);
      if (v === c) return;
      var pos = this.selectionStart || c.length;
      this.value = c;
      try { this.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    });
  }

  App.ui = {
    toast: toast,
    hideToast: hideToast,
    confirm: dialog,
    confirmType: confirmType,
    sheet: sheet,
    actionSheet: actionSheet,
    monthBar: monthBar,
    bindAmountInput: bindAmountInput
  };
})(window.App);
