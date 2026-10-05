/* ============================================================
 * 模块二：条理表达（三页签）
 * 🎯 情景训练：选方法 → 情境题 → 语音作答 → 结构分析 → 参考思路/答案
 * 🧪 方法练习：方法结构讲解 + 环节识别小测
 * 🗂 题目库：全部题目浏览搜索，一键开练
 * 训练页随时可点「📖 回顾法则」查看当前方法结构，或跳转方法练习。
 * ============================================================ */
(function () {

  App.register('express', function (root) {
    root.innerHTML =
      '<div class="page-head"><div><h1>🧭 条理表达</h1><div class="sub">32 个情境题 × 18 种表达方法：先练方法，再进情境，忘了法则随时回顾。</div></div></div>' +
      '<div class="tabs" id="ex-tabs">' +
      '<button class="tab active" data-t="train">🎯 情景训练</button>' +
      '<button class="tab" data-t="drill">🧪 方法练习</button>' +
      '<button class="tab" data-t="library">🗂 题目库</button>' +
      '</div><div id="express-body"></div>';
    const body = root.querySelector('#express-body');

    let fwKey = null;
    let topic = null;

    /* ---------- 数据 ---------- */
    function allTopics() {
      const enrich = ET_CONTENT.TOPIC_ENRICH || {};
      const fits = ET_CONTENT.TOPIC_FIT || {};
      return ET_CONTENT.TOPICS
        .map(t => Object.assign({}, t, enrich[t.id] || {}, fits[t.id] ? { fit: fits[t.id] } : {}))
        .concat(ET_CONTENT.SCENARIO_TOPICS || []);
    }
    function topicCount() { return allTopics().length; }

    /* ---------- 页签切换 ---------- */
    function switchTab(t, arg) {
      root.querySelectorAll('#ex-tabs .tab').forEach(x => x.classList.toggle('active', x.getAttribute('data-t') === t));
      App.destroyPanels();
      SpeechKit.TTS.stop();
      body.innerHTML = '';
      if (t === 'train') showSetup();
      else if (t === 'drill') renderDrills(arg);
      else renderLibrary();
    }
    root.querySelectorAll('#ex-tabs .tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.getAttribute('data-t')));
    });
    function gotoTrain(newTopic) {
      if (newTopic) topic = newTopic;
      root.querySelectorAll('#ex-tabs .tab').forEach(x => x.classList.toggle('active', x.getAttribute('data-t') === 'train'));
      App.destroyPanels();
      SpeechKit.TTS.stop();
      body.innerHTML = '';
      showTrain();
    }

    /* ---------- 回顾法则弹窗 ---------- */
    function openFwModal(key) {
      const fw = Analyzer.FRAMEWORKS[key];
      const mask = App.el(
        '<div class="modal-mask"><div class="modal-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
        '<div class="sec-title" style="margin:0">📖 ' + fw.name + '</div>' +
        '<button class="btn ghost sm m-close">✕ 关闭</button></div>' +
        '<div class="fw-flow mt-sm">' + fw.flow.map(x => '<span class="chip">' + x + '</span>').join('<i>→</i>') + '</div>' +
        '<p class="peek-note mt-sm">' + App.esc(fw.intro) + '</p>' +
        '<div class="checklist mt-sm">' +
        fw.elements.map(e => '<div class="ck"><b>' + e.label.split('·')[0].trim() + '</b><span>' + App.esc(e.tip) + '</span></div>').join('') +
        '</div>' +
        '<div class="mt" style="display:flex;gap:10px">' +
        '<button class="btn primary m-drill">🧪 去练习这个方法</button>' +
        '</div></div></div>'
      );
      document.body.appendChild(mask);
      mask.querySelector('.m-close').addEventListener('click', () => mask.remove());
      mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
      mask.querySelector('.m-drill').addEventListener('click', () => { mask.remove(); switchTab('drill', key); });
    }

    /* ============================================================
     * 页签一：情景训练
     * ============================================================ */
    function showSetup() {
      const intro = App.el(
        '<div class="card">' +
        '<div class="sec-title">第一步 · 选择表达方法（共 ' + Analyzer.FW_KEYS.length + ' 种，也可随机）</div>' +
        '<div class="fw-grid" id="fw-grid"></div>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn primary" id="fw-go">🎯 随机抽题，进入情境</button>' +
        '<button class="btn ghost" id="fw-lib">🗂 先逛逛题目库</button>' +
        '<span class="peek-note">题目都是真实情境：先看身份和场景，再开口。</span>' +
        '</div></div>'
      );
      body.appendChild(intro);
      const grid = intro.querySelector('#fw-grid');
      Analyzer.FW_KEYS.forEach(k => {
        const f = Analyzer.FRAMEWORKS[k];
        const c = App.el(
          '<div class="fw-card" data-k="' + k + '">' +
          '<b>' + f.name + '</b><span>' + f.intro + '</span>' +
          '<div class="fw-flow">' + f.flow.map(x => '<span class="chip">' + x + '</span>').join('<i>→</i>') + '</div>' +
          '</div>'
        );
        c.addEventListener('click', () => {
          fwKey = (fwKey === k) ? null : k;
          grid.querySelectorAll('.fw-card').forEach(x => x.classList.toggle('picked', x.getAttribute('data-k') === fwKey));
        });
        grid.appendChild(c);
      });
      intro.querySelector('#fw-go').addEventListener('click', () => {
        if (!fwKey) fwKey = App.pick(Analyzer.FW_KEYS);
        topic = App.pick(allTopics());
        showTrain();
      });
      intro.querySelector('#fw-lib').addEventListener('click', () => switchTab('library'));
    }

    function showTrain() {
      App.destroyPanels();
      const f = Analyzer.FRAMEWORKS[fwKey];
      const enrich = ET_CONTENT.TOPIC_ENRICH[topic.id] || {};
      body.innerHTML =
        '<div class="grid cols-2">' +
        '<div class="card topic-card">' +
        '<div class="sec-title" style="margin-bottom:6px">🎯 情景任务 <span class="chip info">' + f.name + '</span></div>' +
        '<h2>' + App.esc(topic.title) + '</h2>' +
        (topic.role ? '<div class="topic-role">👤 你的身份：' + App.esc(topic.role) + '</div>' : '') +
        '<div class="topic-sit">' + App.esc(topic.situation || topic.bg) + '</div>' +
        (topic.fit ? '<div class="topic-fit">💡 推荐方法：' + topic.fit.map(n => '<span class="chip ok">' + n + '</span>').join(' ') + '</div>' : '') +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn ghost sm" id="ex-newtopic">🎲 换一题</button>' +
        '<button class="btn ghost sm" id="ex-newfw">🧭 换方法</button>' +
        '<button class="btn soft sm" id="ex-review">📖 回顾法则</button>' +
        '</div></div>' +
        '<div class="card">' +
        '<div class="sec-title">📋 按这个结构来说</div>' +
        '<div class="checklist">' +
        f.elements.map(e => '<div class="ck"><b>' + e.label.split('·')[0].trim() + '</b><span>' + App.esc(e.tip) + '</span></div>').join('') +
        '</div>' +
        '<label class="limit-toggle"><input type="checkbox" id="ex-limit"> ⏱ 限时挑战：90 秒倒计时，时间到自动交卷（模拟会上被点名的压力）</label>' +
        '</div>' +
        '</div>' +
        '<div class="card" id="ex-panel-holder" style="padding:0;border:none;box-shadow:none;background:transparent"></div>';

      const holder = body.querySelector('#ex-panel-holder');
      const limitOn = () => !!(body.querySelector('#ex-limit') && body.querySelector('#ex-limit').checked);
      const panel = App.createVoicePanel({
        placeholder: '点击麦克风，以「' + (topic.role || '你的身份') + '」的角度开口练习……也可以直接打字。',
        limit: () => limitOn() ? 90 : 0,
        onTimeout: () => {
          const t = panel.getText();
          if (t) { panel.destroy(); showResult(t, true); }
          else App.toast('时间到，但还没有内容——再试一次，先说结论！', 'warn');
        }
      });
      holder.appendChild(panel.root);
      const bar = App.el(
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="ex-done">✅ 完成，开始分析</button>' +
        '<button class="btn ghost" id="ex-back">← 返回选择</button>' +
        '</div>'
      );
      holder.appendChild(bar);

      body.querySelector('#ex-newtopic').addEventListener('click', () => {
        const used = allTopics().filter(t => t.id !== topic.id);
        topic = App.pick(used.length ? used : allTopics());
        showTrain();
      });
      body.querySelector('#ex-newfw').addEventListener('click', () => {
        fwKey = App.pickExcept(Analyzer.FW_KEYS.map(k => ({ id: k })), [fwKey]).id;
        showTrain();
      });
      body.querySelector('#ex-review').addEventListener('click', () => openFwModal(fwKey));
      body.querySelector('#ex-back').addEventListener('click', showSetup);
      body.querySelector('#ex-done').addEventListener('click', () => {
        const text = panel.getText();
        if (!text) { App.toast('先以情境中的身份开口说一段，或输入文字', 'warn'); return; }
        panel.destroy();
        showResult(text);
      });
    }

    function showResult(text, limited) {
      App.destroyPanels();
      const f = Analyzer.FRAMEWORKS[fwKey];
      const r = Analyzer.analyzeFramework(fwKey, text);
      App.history.add({ module: 'express', title: (limited ? '⏱' : '') + topic.title + ' · ' + f.name, score: r.score });
      const approach = topic.approach || [
        '套用' + f.name + '的顺序：' + f.flow.join(' → '),
        '每个环节至少一句话，理由和例子要具体，不说空话',
        '结尾回扣开头，或落到一句行动/金句'
      ];

      body.innerHTML =
        '<div class="card">' +
        '<div class="result-top">' + App.ringHTML(r.score, '#4f46e5') +
        '<div class="result-brief">' +
        '<div class="headline">' + r.level.stars + '　' + r.level.label + '</div>' +
        '<div class="dim-chips">' + r.elements.map(e =>
          '<span class="chip ' + (e.matched ? 'ok' : 'bad') + '">' + (e.matched ? '✔' : '✘') + ' ' + e.label + '</span>'
        ).join('') + '</div>' +
        '<div class="dim-chips">' +
        '<span class="chip">' + r.len + ' 字</span>' +
        '<span class="chip">' + r.clauses + ' 个语句</span>' +
        '<span class="chip info">' + f.name + '</span>' +
        (limited ? '<span class="chip warn">⏱ 限时挑战 90 秒</span>' : '') +
        '</div></div></div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">✅ 做得好的地方</div><div id="res-strengths"></div>' +
        '<div class="sec-title mt">⚠️ 不足与建议</div><div id="res-weaknesses"></div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">🧭 参考作答思路（按步骤想，再对照原文）</div>' +
        '<div class="checklist">' + approach.map((s, i) => '<div class="ck"><b>步骤' + (i + 1) + '</b><span>' + App.esc(s) + '</span></div>').join('') + '</div>' +
        '<div class="sec-title mt">🗣️ 我的表达原文</div>' +
        '<div class="ref-answer" style="background:#f8f9fd;border-style:solid;border-color:#e7eaf3">' + App.esc(text) + '</div>' +
        '<div class="sec-title mt">📖 参考答案（示例思路，可换成自己的经历）</div>' +
        '<div class="ref-answer" id="ref-answer" style="display:none">' + App.esc(Analyzer.buildReference(fwKey, topic)) + '</div>' +
        '<button class="btn soft mt-sm" id="ref-toggle">👀 显示参考答案</button>' +
        '<div class="divider"></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="ex-again">🎯 再练一题</button>' +
        '<button class="btn ghost" id="ex-retry">🔁 同题重来</button>' +
        '<button class="btn ghost" id="ex-review2">📖 回顾法则</button>' +
        '<button class="btn ghost" id="ex-setup2">🧭 换个方法</button>' +
        '</div></div>';

      const stBox = body.querySelector('#res-strengths');
      (r.strengths.length ? r.strengths : [{ title: '暂未检测到明显亮点', text: '别灰心，先按下面的建议补齐结构，再谈发挥。' }])
        .forEach(s => stBox.appendChild(App.el('<div class="evidence"><b>' + App.esc(s.title) + '</b><br>' + App.esc(s.text) + '</div>')));
      const wkBox = body.querySelector('#res-weaknesses');
      (r.weaknesses.length ? r.weaknesses : [{ title: '没有明显短板', text: '结构完整、表达干净，可以挑战更高难度的框架了。' }])
        .forEach(s => wkBox.appendChild(App.el('<div class="weak-item"><b>' + App.esc(s.title) + '</b><br>' + App.esc(s.text) + '</div>')));

      body.querySelector('#ref-toggle').addEventListener('click', function () {
        const box = body.querySelector('#ref-answer');
        const show = box.style.display === 'none';
        box.style.display = show ? 'block' : 'none';
        this.textContent = show ? '🙈 收起参考答案' : '👀 显示参考答案';
      });
      body.querySelector('#ex-again').addEventListener('click', () => {
        topic = App.pick(allTopics());
        fwKey = App.pick(Analyzer.FW_KEYS);
        showTrain();
      });
      body.querySelector('#ex-retry').addEventListener('click', showTrain);
      body.querySelector('#ex-review2').addEventListener('click', () => openFwModal(fwKey));
      body.querySelector('#ex-setup2').addEventListener('click', showSetup);
      App.animateRings(body);
    }

    /* ============================================================
     * 页签二：方法练习（结构讲解 + 环节识别小测）
     * ============================================================ */
    function renderDrills(preselect) {
      body.innerHTML = '';
      const sel = App.el(
        '<div class="card"><div class="sec-title">🧪 先认识，再小测：选一个方法</div>' +
        '<div class="fw-grid" id="drill-grid"></div></div>'
      );
      body.appendChild(sel);
      const grid = sel.querySelector('#drill-grid');
      Analyzer.FW_KEYS.forEach(k => {
        const f = Analyzer.FRAMEWORKS[k];
        const c = App.el('<div class="fw-card" data-k="' + k + '"><b>' + f.name + '</b><span>' + f.intro + '</span><div class="fw-flow">' + f.flow.map(x => '<span class="chip">' + x + '</span>').join('<i>→</i>') + '</div></div>');
        c.addEventListener('click', () => showLearnPanel(k));
        grid.appendChild(c);
      });
      if (preselect) showLearnPanel(preselect);
    }

    function showLearnPanel(key) {
      App.destroyPanels();
      fwKey = key;
      const f = Analyzer.FRAMEWORKS[key];
      // 已选卡片高亮
      body.querySelectorAll('#drill-grid .fw-card').forEach(x => x.classList.toggle('picked', x.getAttribute('data-k') === key));

      const old = body.querySelector('#drill-panel');
      if (old) old.remove();
      const panel = App.el(
        '<div class="card mt" id="drill-panel">' +
        '<div class="sec-title">📖 ' + f.name + ' <span class="chip info">' + f.flow.join(' → ') + '</span></div>' +
        '<p class="peek-note">' + App.esc(f.intro) + '</p>' +
        '<div class="checklist mt-sm">' +
        f.elements.map(e => '<div class="ck"><b>' + e.label.split('·')[0].trim() + '</b><span>' + App.esc(e.tip) + '</span></div>').join('') +
        '</div>' +
        '<div class="sec-title mt">📝 示例拆解（每个环节长什么样）</div>' +
        '<div class="ref-answer" id="drill-ref"></div>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="drill-start">✏️ 开始小测（5 题）</button>' +
        '<button class="btn ghost" id="drill-speak">🔊 听一遍示例</button>' +
        '</div>' +
        '<div id="drill-quiz" class="mt"></div>' +
        '</div>'
      );
      body.appendChild(panel);

      // 示例拆解：把参考答案按【环节】分行高亮
      const ref = Analyzer.buildReference(key, allTopics()[0]);
      panel.querySelector('#drill-ref').innerHTML = ref.split(/\n+/).map(line => {
        const m = line.match(/^【(.+?)】([\s\S]*)$/);
        return m
          ? '<div class="ref-line"><b>【' + App.esc(m[1]) + '】</b>' + App.esc(m[2]) + '</div>'
          : '<div>' + App.esc(line) + '</div>';
      }).join('');
      panel.querySelector('#drill-speak').addEventListener('click', () => SpeechKit.TTS.speak(ref.replace(/【|】/g, '。')));

      panel.querySelector('#drill-start').addEventListener('click', () => startDrillQuiz(key, panel.querySelector('#drill-quiz')));
    }

    function startDrillQuiz(key, holder) {
      const f = Analyzer.FRAMEWORKS[key];
      // 从两个不同题目的参考答案里取环节句，组成小测
      const segs = [];
      const tps = allTopics();
      [tps[0], tps[Math.min(4, tps.length - 1)]].forEach(tp => {
        Analyzer.buildReference(key, tp).split(/\n+/).forEach(line => {
          const m = line.match(/^【(.+?)】([\s\S]*)$/);
          if (m && m[2].trim()) segs.push({ label: m[1], text: m[2].trim() });
        });
      });
      const labels = [...new Set(segs.map(s => s.label))];
      const questions = segs.slice().sort(() => Math.random() - 0.5).slice(0, 5);
      let qi = 0, correct = 0;

      function renderQ() {
        if (qi >= questions.length) {
          const score = Math.round(correct / questions.length * 100);
          App.history.add({ module: 'express', title: '方法练习 · ' + f.name, score });
          holder.innerHTML =
            '<div class="evidence"><b>小测完成！' + (score >= 80 ? '这个方法你已经吃透了 🎉' : '对了 ' + correct + '/' + questions.length + '，再看看上面的示例拆解，然后重测一次。') + '</b><br>' +
            '正确率 ' + score + '%　<button class="btn soft sm" id="drill-retry" style="margin-left:8px">🔁 重测</button>' +
            ' <button class="btn ghost sm" id="drill-gotrain">🎯 用这个方法去练一题 →</button></div>';
          holder.querySelector('#drill-retry').addEventListener('click', () => startDrillQuiz(key, holder));
          holder.querySelector('#drill-gotrain').addEventListener('click', () => gotoTrain(App.pick(allTopics())));
          return;
        }
        const q = questions[qi];
        const opts = labels.slice().sort(() => Math.random() - 0.5);
        holder.innerHTML =
          '<div class="sec-title">第 ' + (qi + 1) + ' / ' + questions.length + ' 题　<span class="chip ok">答对 ' + correct + '</span></div>' +
          '<div class="quiz-q" style="font-size:16px;text-align:left;margin:10px 0">「' + App.esc(q.text) + '」</div>' +
          '<div class="peek-note">这句话属于' + f.name + '的哪个环节？</div>' +
          '<div id="dq-opts"></div>';
        const optsEl = holder.querySelector('#dq-opts');
        let answered = false;
        opts.forEach(o => {
          const b = App.el('<button class="quiz-option">' + App.esc(o) + '</button>');
          b.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            if (o === q.label) {
              correct++;
              b.classList.add('correct');
              App.toast('答对了！就是「' + q.label + '」环节', 'ok');
            } else {
              b.classList.add('wrong');
              optsEl.querySelectorAll('.quiz-option').forEach(x => {
                if (x.textContent === q.label) x.classList.add('correct');
              });
              App.toast('正确答案：「' + q.label + '」', 'warn');
            }
            setTimeout(() => { qi++; renderQ(); }, 1100);
          });
          optsEl.appendChild(b);
        });
      }
      renderQ();
    }

    /* ============================================================
     * 页签三：题目库
     * ============================================================ */
    function renderLibrary() {
      const topics = allTopics();
      body.innerHTML =
        '<div class="card"><div class="sec-title">🗂 全部题目库 <span class="chip info">' + topics.length + ' 道情境题</span></div>' +
        '<input class="input-area lib-search" id="lib-search" style="min-height:0;padding:10px 14px" placeholder="搜索题目关键词，如：面试、汇报、转岗、团建……">' +
        '<div class="peek-note mt-sm">点击任意题目，直接以当前选择的方法开练（未选方法则随机）。</div>' +
        '<div id="lib-list" class="mt"></div></div>';
      const list = body.querySelector('#lib-list');
      const search = body.querySelector('#lib-search');

      function renderList(kw) {
        const kws = (kw || '').trim();
        const filtered = kws ? topics.filter(t =>
          (t.title + (t.role || '') + (t.situation || t.bg || '') + (t.fit || []).join('')).indexOf(kws) >= 0) : topics;
        list.innerHTML = '';
        if (!filtered.length) {
          list.innerHTML = '<div class="peek-note">没有找到包含「' + App.esc(kws) + '」的题目，换个关键词试试。</div>';
          return;
        }
        filtered.forEach(t => {
          const card = App.el(
            '<div class="lib-item">' +
            '<div style="flex:1;min-width:0"><b>' + App.esc(t.title) + '</b>' +
            (t.role ? '<div class="peek-note">👤 ' + App.esc(t.role) + ' · ' + App.esc((t.situation || t.bg || '').slice(0, 46)) + '…</div>' : '') +
            (t.fit ? '<div class="mt-sm">' + t.fit.map(n => '<span class="chip ok">' + n + '</span>').join(' ') + '</div>' : '') +
            '</div>' +
            '<button class="btn primary sm lib-go">开始练习 →</button>' +
            '</div>'
          );
          card.querySelector('.lib-go').addEventListener('click', () => {
            if (!fwKey) fwKey = App.pick(Analyzer.FW_KEYS);
            gotoTrain(t);
          });
          list.appendChild(card);
        });
      }
      search.addEventListener('input', () => renderList(search.value));
      renderList('');
    }

    /* ---------- 入口 ---------- */
    showSetup();
  });

})();
