/* ============================================================
 * 应用框架：路由 / 首页 / 通用组件（录音面板、评分环、Toast）/ 训练记录
 * ============================================================ */
window.App = (() => {

  const modules = {};
  let activePanels = [];

  /* ---------- 工具 ---------- */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function toast(msg, type) {
    const root = document.getElementById('toast-root');
    const t = el('<div class="toast ' + (type || '') + '">' + esc(msg) + '</div>');
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(() => t.remove(), 2600);
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickExcept(arr, used) {
    const rest = arr.filter(x => used.indexOf(x.id) < 0);
    return rest.length ? pick(rest) : pick(arr);
  }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  /* ---------- 评分环 ---------- */
  function ringHTML(score, color, size) {
    size = size || 128;
    const stroke = 11, r = (size - stroke) / 2 - 2, c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#edf0f6" stroke-width="' + stroke + '"/>' +
      '<circle class="ring-fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" data-off="' + off + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '</svg><div class="ring-label"><b>' + score + '</b><span>综合得分</span></div></div>';
  }
  function animateRings(container) {
    setTimeout(() => {
      container.querySelectorAll('.ring-fg').forEach(cir => {
        cir.style.strokeDashoffset = cir.getAttribute('data-off');
      });
    }, 60);
  }

  /* ---------- 训练记录 ---------- */
  const history = {
    all() { try { return JSON.parse(localStorage.getItem('et_history') || '[]'); } catch (_) { return []; } },
    add(entry) {
      const list = history.all();
      list.unshift(Object.assign({ time: Date.now() }, entry));
      localStorage.setItem('et_history', JSON.stringify(list.slice(0, 100)));
    },
    stats() {
      const list = history.all();
      const week = Date.now() - 7 * 24 * 3600 * 1000;
      return {
        total: list.length,
        week: list.filter(x => x.time >= week).length,
        byModule: m => list.filter(x => x.module === m).length,
        recent: list.slice(0, 6)
      };
    }
  };

  /* ---------- 语音输入面板（通用组件） ---------- */
  /**
   * createVoicePanel({placeholder}) → { root, getText, clear, destroy }
   */
  function createVoicePanel(opts) {
    opts = opts || {};
    const state = { listening: false, startAt: 0, timerInt: null, vi: null, limit: opts.limit || 0, fired: false };

    const root = el(
      '<div class="card voice-panel">' +
      '<div class="vp-row">' +
      '<button class="mic-btn" title="开始 / 停止录音">🎤</button>' +
      '<div class="vp-stats">' +
      '<span class="vp-stat">⏱ <b class="vp-timer">00:00</b></span>' +
      '<span class="vp-stat">🔤 <b class="vp-count">0</b> 字</span>' +
      '</div>' +
      '<span class="chip vp-perm" style="display:none"></span>' +
      '<span class="vp-state"></span>' +
      '<button class="btn ghost sm vp-clear" style="margin-left:auto">清空</button>' +
      '</div>' +
      '<textarea class="input-area" placeholder="' + esc(opts.placeholder || '点击麦克风开始说话，或直接在此输入……') + '"></textarea>' +
      '<div class="vp-hint"></div>' +
      '</div>'
    );
    const micBtn = root.querySelector('.mic-btn');
    const timerEl = root.querySelector('.vp-timer');
    const countEl = root.querySelector('.vp-count');
    const stateEl = root.querySelector('.vp-state');
    const hintEl = root.querySelector('.vp-hint');
    const area = root.querySelector('.input-area');

    function updateCount() { countEl.textContent = area.value.replace(/\s/g, '').length; }
    function setState() {
      stateEl.textContent = state.listening ? '● 录音中' : '';
      stateEl.className = 'vp-state' + (state.listening ? ' on' : '');
      micBtn.classList.toggle('listening', state.listening);
      micBtn.textContent = state.listening ? '⏹' : '🎤';
    }
    function startTimer() {
      state.startAt = Math.floor(Date.now() / 1000);
      state.fired = false;
      clearInterval(state.timerInt);
      state.timerInt = setInterval(() => {
        const limitVal = typeof state.limit === 'function' ? (state.limit() || 0) : (state.limit || 0);
        const elapsed = Math.floor(Date.now() / 1000) - state.startAt;
        if (limitVal) {
          const left = Math.max(0, limitVal - elapsed);
          timerEl.textContent = '剩余 ' + fmtTime(left);
          timerEl.style.color = left <= 15 && left > 0 ? 'var(--rose)' : '';
          if (left <= 0 && !state.fired) {
            state.fired = true;
            stopListen();
            App.toast('⏱ 时间到！自动交卷');
            if (opts.onTimeout) setTimeout(opts.onTimeout, 150);
          }
        } else {
          timerEl.textContent = fmtTime(elapsed);
        }
      }, 250);
    }
    function stopTimer() { clearInterval(state.timerInt); state.timerInt = null; }

    /* 麦克风权限状态标签 */
    const permChip = root.querySelector('.vp-perm');
    const PERM_TIP = '如果每次都要重新允许：点击浏览器地址栏左侧的 🔒 图标 → 「网站设置」→ 麦克风 → 选择「允许」，一次设置长期有效。';
    function renderPerm(st) {
      if (!permChip) return;
      if (st === 'granted') { permChip.textContent = '🎤 麦克风已授权'; permChip.className = 'chip ok vp-perm'; }
      else if (st === 'denied') { permChip.textContent = '🎤 权限被拒'; permChip.className = 'chip bad vp-perm'; }
      else if (st === 'prompt') { permChip.textContent = '🎤 首次使用需允许'; permChip.className = 'chip warn vp-perm'; }
      else { permChip.style.display = 'none'; return; }
      permChip.style.display = '';
      permChip.title = PERM_TIP;
    }
    if (permChip) {
      SpeechKit.MicPerm.state().then(renderPerm);
    }

    if (!SpeechKit.supported) {
      micBtn.disabled = true;
      hintEl.textContent = '当前浏览器不支持语音识别，可直接打字输入（推荐使用 Chrome / Edge 获得语音体验）。';
    } else {
      hintEl.textContent = '点击麦克风开始录音，识别结果会实时显示，可随时手动修改。首次使用需允许麦克风：弹窗里选择「允许」即可记住；若每次都询问，点地址栏左侧 🔒 → 网站设置 → 麦克风 → 允许。';
      state.vi = new SpeechKit.VoiceInput((finalText, interim) => {
        area.value = (finalText + interim).trim();
        updateCount();
      }, (code) => {
        stopListen();
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          toast('麦克风权限被拒绝，请按提示重新授权', 'warn');
          hintEl.textContent = '⚠ 麦克风权限被拒绝。点击浏览器地址栏左侧的 🔒 图标 → 「网站设置」→ 麦克风 → 选择「允许」，然后刷新页面即可长期生效。也可以直接打字输入。';
        } else if (code === 'audio-capture') {
          toast('未检测到可用的麦克风设备', 'warn');
          hintEl.textContent = '⚠ 没有检测到麦克风。请检查设备连接与系统输入设置，或直接打字输入。';
        } else if (code === 'unstable') {
          toast('语音服务连接持续不稳定，请检查网络后重试', 'warn');
          hintEl.textContent = '⚠ 网络持续不稳定（语音识别需要联网）。网络恢复后再试，或直接打字输入。';
        } else if (code === 'restart-fail') {
          toast('语音识别异常中断，请重新点击麦克风', 'warn');
        } else {
          toast('语音识别出错了（' + code + '），可改用打字输入', 'warn');
        }
        SpeechKit.MicPerm.state().then(renderPerm);
      });
    }

    function startListen() {
      if (!state.vi) return;
      state.listening = true;
      area.value = '';
      state.vi.start();
      startTimer(); setState();
    }
    function stopListen() {
      state.listening = false;
      if (state.vi) state.vi.stop();
      stopTimer(); setState();
    }
    micBtn.addEventListener('click', () => {
      state.listening ? stopListen() : startListen();
    });
    root.querySelector('.vp-clear').addEventListener('click', () => {
      area.value = ''; updateCount();
      if (state.listening) { stopListen(); }
    });
    area.addEventListener('input', updateCount);

    const panel = {
      root,
      getText: () => area.value.trim(),
      setText(t) { area.value = t || ''; updateCount(); },
      clear() { area.value = ''; updateCount(); },
      seconds: () => (state.timerInt ? Math.floor(Date.now() / 1000) - state.startAt : 0),
      destroy() {
        stopListen();
        stopTimer();
        if (state.vi) state.vi.destroy();
      }
    };
    activePanels.push(panel);
    return panel;
  }

  function destroyPanels() {
    activePanels.forEach(p => p.destroy());
    activePanels = [];
    SpeechKit.TTS.stop();
  }

  /* ---------- 首页 ---------- */
  const MODULE_META = [
    { key: 'warmup', icon: '🔥', name: '朗读热身', cls: 'theme-warmup', color: '#d97706', desc: '绕口令 · 成语充电 · 美文朗读，先让口齿和状态热起来。' },
    { key: 'express', icon: '🧭', name: '条理表达', cls: 'theme-express', color: '#4f46e5', desc: '随机抽题，用金字塔 / PREP / SCQA 等框架练习，AI 逐项分析结构。' },
    { key: 'retell', icon: '🔁', name: '复述训练', cls: 'theme-retell', color: '#0d9488', desc: '随机科普短文，读后复述，分析要点覆盖与结构完整度。' },
    { key: 'persuade', icon: '🎯', name: '临场说服', cls: 'theme-persuade', color: '#e11d48', desc: '随机场景多轮对话，实战说服对方，逐轮反馈 + 复盘参考话术。' }
  ];

  function renderHome(root) {
    const st = history.stats();
    root.innerHTML = '';

    const hero = el(
      '<section class="hero">' +
      '<h2>每天十分钟，开口就赢 🎙️</h2>' +
      '<p>从口齿热身到即兴说服，四个模块覆盖表达力训练全流程。所有分析都在你的浏览器里完成，没有旁观者，大胆开口练。</p>' +
      '<div class="hero-btns">' +
      '<a class="btn light" href="#/warmup">🔥 从热身开始</a>' +
      '<a class="btn ghost-light" href="#/express">🧭 直接练表达</a>' +
      '</div>' +
      '<div class="hero-kv">' +
      '<div class="item"><b>' + st.total + '</b><span>累计训练</span></div>' +
      '<div class="item"><b>' + st.week + '</b><span>本周训练</span></div>' +
      '<div class="item"><b>4</b><span>训练模块</span></div>' +
      '<div class="item"><b>' + Analyzer.FW_KEYS.length + '</b><span>表达方法</span></div>' +
      '</div>' +
      '</section>'
    );

    const cardsWrap = el('<section class="mt"><div class="sec-title">🚩 训练模块</div><div class="module-cards"></div></section>');
    const cards = cardsWrap.querySelector('.module-cards');
    MODULE_META.forEach(m => {
      const c = el(
        '<a class="m-card" href="#/' + m.key + '">' +
        '<div class="m-icon" style="background:' + m.color + '18">' + m.icon + '</div>' +
        '<h3>' + m.name + '</h3><p>' + m.desc + '</p>' +
        '<div class="m-foot"><span>已练 ' + st.byModule(m.key) + ' 次</span><span class="arrow">开始 →</span></div>' +
        '</a>'
      );
      cards.appendChild(c);
    });

    /* ---------- 训练统计 ---------- */
    const all = history.all();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const s = d.getTime(), e = s + 86400000;
      days.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), count: all.filter(x => x.time >= s && x.time < e).length });
    }
    const maxC = Math.max(1, ...days.map(d => d.count));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const s = d.getTime(), e = s + 86400000;
      const c = all.filter(x => x.time >= s && x.time < e).length;
      if (c > 0) streak++;
      else if (i > 0) break;
    }
    const modStats = MODULE_META.map(m => {
      const recs = all.filter(x => x.module === m.key);
      const avg = recs.length ? Math.round(recs.reduce((s, x) => s + (x.score || 0), 0) / recs.length) : 0;
      return { name: m.name, icon: m.icon, count: recs.length, avg };
    });
    const maxMod = Math.max(1, ...modStats.map(m => m.count));

    const statWrap = el(
      '<section class="card mt"><div class="sec-title">📊 训练统计 <span class="chip ' + (streak > 0 ? 'ok' : '') + '">🔥 连续打卡 ' + streak + ' 天</span></div>' +
      (all.length === 0
        ? '<div class="peek-note">完成第一次训练后，这里会出现你的训练曲线、模块分布和连续打卡记录。</div>'
        : '<div class="stats-grid">' +
        '<div><div class="peek-note">最近 14 天训练次数</div>' +
        '<div class="act-chart">' + days.map(d =>
          '<div class="act-col" title="' + d.label + '：' + d.count + ' 次"><div class="act-bar" style="height:' + Math.round(d.count / maxC * 100) + '%"></div></div>'
        ).join('') + '</div>' +
        '<div class="act-labels">' + days.map(d => '<span>' + d.label + '</span>').join('') + '</div></div>' +
        '<div><div class="peek-note">模块分布 · 平均分</div>' +
        modStats.map(m =>
          '<div class="dist-row"><span class="dist-name">' + m.icon + ' ' + m.name + '</span>' +
          '<div class="dist-track"><div class="dist-bar" style="width:' + Math.round(m.count / maxMod * 100) + '%"></div></div>' +
          '<span class="dist-val">' + m.count + ' 次' + (m.count ? ' · 均 ' + m.avg + ' 分' : '') + '</span></div>'
        ).join('') + '</div>' +
        '</div>') +
      '</section>'
    );

    const methods = Analyzer.FRAMEWORKS;
    const methodWrap = el('<section class="mt"><div class="sec-title">📚 表达方法论速览 <span class="chip info">条理表达模块可用</span></div><div class="method-grid"></div></section>');
    const mg = methodWrap.querySelector('.method-grid');
    Analyzer.FW_KEYS.forEach(k => {
      const f = methods[k];
      mg.appendChild(el(
        '<div class="method-item"><b>' + f.name + '　<span style="font-weight:400;font-size:12px;color:#9aa1b2">' + f.flow.join(' → ') + '</span></b><span>' + f.intro + '</span></div>'
      ));
    });

    const tips = el(
      '<section class="card mt"><div class="sec-title">💡 推荐训练路线</div>' +
      '<ul class="read-tips">' +
      '<li><b>第 1 步 · 热身（3 分钟）</b>：绕口令 2 遍 + 一段美文朗读，唤醒口齿与语感。</li>' +
      '<li><b>第 2 步 · 条理表达（5 分钟）</b>：随机抽题，选一个框架（新手建议从 PREP 开始），语音作答后查看逐项分析。</li>' +
      '<li><b>第 3 步 · 复述（4 分钟）</b>：读一篇科普短文，合上原文复述，检验信息提取能力。</li>' +
      '<li><b>第 4 步 · 临场说服（5 分钟）</b>：随机场景实战对话，练共情、利益、让步与行动建议的组合拳。</li>' +
      '</ul>' +
      '<div class="peek-note mt-sm">🎙️ 语音功能需要麦克风权限，推荐 Chrome / Edge 浏览器；不支持时所有模块都可以打字输入。</div>' +
      '</section>'
    );

    const histCard = el('<section class="card mt"><div class="sec-title" style="justify-content:space-between">📈 最近训练<span style="display:flex;gap:6px;font-weight:400"><button class="btn ghost sm" id="hist-export">⬇ 导出记录</button><button class="btn danger sm" id="hist-clear">🗑 清空</button></span></div><div class="hist-list"></div></section>');
    const hl = histCard.querySelector('.hist-list');
    if (!st.recent.length) {
      hl.appendChild(el('<div class="peek-note">还没有训练记录，从上面任意模块开始你的第一次练习吧。</div>'));
    } else {
      const MOD_NAME = { warmup: '朗读热身', express: '条理表达', retell: '复述训练', persuade: '临场说服' };
      st.recent.forEach(r => {
        const color = r.score >= 70 ? 'var(--green)' : r.score >= 55 ? 'var(--amber)' : 'var(--rose)';
        hl.appendChild(el(
          '<div class="hist-item"><span class="badge ' + (MODULE_META.find(m => m.key === r.module) || {}).cls + '">' + (MOD_NAME[r.module] || r.module) + '</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.title || '') + '</span>' +
          '<b class="score" style="color:' + color + '">' + r.score + '</b>' +
          '<span class="t">' + new Date(r.time).toLocaleDateString('zh-CN') + '</span></div>'
        ));
      });
    }

    histCard.querySelector('#hist-export').addEventListener('click', () => {
      try {
        const blob = new Blob([JSON.stringify(history.all(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'expression-trainer-records.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        App.toast('记录已导出为 JSON 文件', 'ok');
      } catch (_) { App.toast('导出失败', 'warn'); }
    });
    histCard.querySelector('#hist-clear').addEventListener('click', () => {
      if (!history.all().length) { App.toast('还没有记录可清空'); return; }
      if (confirm('确定清空全部训练记录吗？此操作不可恢复。')) {
        localStorage.removeItem('et_history');
        App.toast('记录已清空', 'ok');
        renderHome(root);
      }
    });

    root.appendChild(hero);
    root.appendChild(cardsWrap);
    root.appendChild(statWrap);
    root.appendChild(methodWrap);
    root.appendChild(tips);
    root.appendChild(histCard);
  }

  /* ---------- 路由 ---------- */
  function navigate() {
    const route = (location.hash.replace(/^#\//, '') || 'home').split('?')[0];
    const root = document.getElementById('view-root');
    destroyPanels();
    document.querySelectorAll('#nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === route);
    });
    window.scrollTo(0, 0);
    if (modules[route]) modules[route](root);
    else renderHome(root);
  }

  function register(name, fn) { modules[name] = fn; }

  function init() {
    /* 深色模式 */
    const themeBtn = document.getElementById('theme-toggle');
    function applyTheme(t) {
      document.body.classList.toggle('dark', t === 'dark');
      themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
    }
    applyTheme(localStorage.getItem('et_theme') || 'light');
    themeBtn.addEventListener('click', () => {
      const next = document.body.classList.contains('dark') ? 'light' : 'dark';
      localStorage.setItem('et_theme', next);
      applyTheme(next);
    });

    window.addEventListener('hashchange', navigate);
    navigate();
  }

  return {
    init, register, el, esc, toast, pick, pickExcept, fmtTime,
    ringHTML, animateRings, createVoicePanel, history, renderHome, MODULE_META,
    destroyPanels
  };
})();
