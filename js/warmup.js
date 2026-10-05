/* ============================================================
 * 模块一：朗读热身
 * 绕口令挑战 / 成语充电（学习+小测）/ 美文朗读
 * ============================================================ */
(function () {

  const D = ET_DATA;
  const LV_NAME = { 1: '初级', 2: '进阶', 3: '挑战' };
  const LV_COLOR = { 1: 'var(--green)', 2: 'var(--amber)', 3: 'var(--rose)' };

  function stars(pct) {
    return pct >= 88 ? '★★★ 优秀' : pct >= 72 ? '★★☆ 良好' : pct >= 55 ? '★☆☆ 一般' : '☆☆☆ 多练几遍';
  }

  /* 生僻字注音块 */
  function glossHTML(gloss) {
    if (!gloss || !gloss.length) return '';
    return '<div class="gloss-box mt"><span class="gloss-badge">🔤 生僻字注音</span>' +
      gloss.map(g =>
        '<span class="gloss-item"><b>' + App.esc(g.w) + '</b>' +
        '<span class="gloss-py">' + App.esc(g.py) + '</span>' +
        (g.m ? '<i class="gloss-m">' + App.esc(g.m) + '</i>' : '') +
        '</span>'
      ).join('') +
      '</div>';
  }

  /* ============ 逐句跟读训练器 ============
   * sentences: 句子数组  opts: { title, onExit }
   */
  function startDrill(holder, sentences, opts) {
    opts = opts || {};
    if (sentences.length < 2) sentences = sentences.concat(['再来一遍，读得更快更清晰。']);
    const state = { idx: 0, scores: [], vi: null, capturing: false, capText: '' };

    const card = App.el(
      '<div class="card drill-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<div class="sec-title" style="margin:0">🔁 逐句跟读 <span class="chip info drill-pos"></span></div>' +
      '<button class="btn ghost sm drill-exit">✕ 退出跟读</button></div>' +
      '<div class="dim-chips drill-chips" style="margin-top:8px"></div>' +
      '<div class="display-text drill-sentence" style="margin-top:12px"></div>' +
      '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn soft drill-listen">🔊 听这句</button>' +
      '<button class="btn primary drill-rec">🎤 跟读这句</button>' +
      '<button class="btn ghost drill-skip">跳过 →</button>' +
      '</div><div class="drill-feedback mt"></div></div>'
    );
    holder.innerHTML = '';
    holder.appendChild(card);

    const posEl = card.querySelector('.drill-pos');
    const chipsEl = card.querySelector('.drill-chips');
    const senEl = card.querySelector('.drill-sentence');
    const recBtn = card.querySelector('.drill-rec');
    const fbEl = card.querySelector('.drill-feedback');

    if (!SpeechKit.supported) {
      recBtn.disabled = true;
      recBtn.title = '当前浏览器不支持语音识别';
    }

    function chipClass(s) { return s == null ? '' : s >= 80 ? 'ok' : s >= 55 ? 'warn' : 'bad'; }
    function drawChips() {
      chipsEl.innerHTML = state.scores.map((s, i) =>
        '<span class="chip ' + chipClass(s) + '">第' + (i + 1) + '句 ' + (s == null ? '—' : s + '%') + '</span>'
      ).join('');
    }
    function showSentence() {
      posEl.textContent = '第 ' + (state.idx + 1) + ' / ' + sentences.length + ' 句';
      senEl.textContent = sentences[state.idx];
      recBtn.textContent = state.capturing ? '⏹ 结束跟读' : '🎤 跟读这句';
      recBtn.classList.toggle('listening', state.capturing);
    }
    function teardown() {
      if (state.vi) { state.vi.destroy(); state.vi = null; }
      state.capturing = false;
    }
    function evaluateCurrent() {
      const txt = (state.vi ? state.vi.finalText : '').trim();
      teardown();
      const sim = txt ? Math.round(Analyzer.similarity(sentences[state.idx], txt) * 100) : 0;
      if (txt) {
        state.scores[state.idx] = sim;
        const advice = sim >= 85 ? '这句过关，节奏和咬字都不错！'
          : sim >= 55 ? '接近了。把不准的字放慢读两遍，再进下一句。'
            : '这句还没对上，建议先「听这句」，再跟读一次。';
        fbEl.innerHTML = '<div class="' + (sim >= 55 ? 'evidence' : 'weak-item') + '"><b>本句相似度 ' + sim + '%</b><br>' +
          '你说的是："' + App.esc(txt.slice(0, 40)) + (txt.length > 40 ? '…' : '') + '"<br>' + advice + '</div>';
      } else {
        state.scores[state.idx] = null;
        fbEl.innerHTML = '<div class="weak-item"><b>没有识别到跟读内容</b><br>请靠近麦克风说完再点「结束跟读」，或检查浏览器麦克风权限。</div>';
      }
      drawChips();
      setTimeout(() => {
        if (state.idx < sentences.length - 1) {
          state.idx++;
          showSentence();
          SpeechKit.TTS.speak(sentences[state.idx]);
        } else {
          finishSession();
        }
      }, 1400);
    }
    function finishSession() {
      teardown();
      const valid = state.scores.filter(s => s != null);
      const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
      App.history.add({ module: 'warmup', title: opts.title || '逐句跟读', score: avg });
      card.innerHTML =
        '<div class="result-top">' + App.ringHTML(avg, '#d97706', 110) +
        '<div class="result-brief"><div class="headline">跟读完成！' + stars(avg) + '</div>' +
        '<div class="dim-chips"><span class="chip">共 ' + sentences.length + ' 句</span>' +
        '<span class="chip info">完成跟读 ' + valid.length + ' 句</span>' +
        '<span class="chip ' + chipClass(avg) + '">平均相似度 ' + avg + '%</span></div>' +
        '<p class="mt-sm" style="font-size:13.5px;color:#6b7280">' +
        (avg >= 85 ? '整段都很扎实，可以直接挑战整段背诵了。' : avg >= 55 ? '整体成形，把低分句挑出来单独再练两遍效果最好。' : '多听示范、放慢速度，跟读几轮分数会明显上来。') +
        '</p></div></div>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn soft drill-retry">🔁 再来一轮</button>' +
        '<button class="btn ghost drill-back">← 返回</button></div>';
      card.querySelector('.drill-retry').addEventListener('click', () => startDrill(holder, sentences, opts));
      card.querySelector('.drill-back').addEventListener('click', opts.onExit);
      App.animateRings(card);
    }

    card.querySelector('.drill-listen').addEventListener('click', () => SpeechKit.TTS.speak(sentences[state.idx]));
    card.querySelector('.drill-skip').addEventListener('click', () => {
      state.scores[state.idx] = null;
      drawChips();
      if (state.idx < sentences.length - 1) { state.idx++; showSentence(); fbEl.innerHTML = ''; }
      else finishSession();
    });
    recBtn.addEventListener('click', () => {
      if (!SpeechKit.supported) return;
      if (state.capturing) { evaluateCurrent(); return; }
      if (!state.vi) {
        state.vi = new SpeechKit.VoiceInput(function () { }, function () {
          teardown(); showSentence();
          fbEl.innerHTML = '<div class="weak-item"><b>麦克风不可用</b><br>请允许浏览器使用麦克风后重试。</div>';
        });
      }
      state.vi.finalText = '';
      state.vi.start();
      state.capturing = true;
      showSentence();
      fbEl.innerHTML = '<div class="peek-note">🔴 正在跟读这句……说完点「⏹ 结束跟读」</div>';
    });
    card.querySelector('.drill-exit').addEventListener('click', () => { teardown(); opts.onExit(); });

    drawChips();
    showSentence();
    SpeechKit.TTS.speak(sentences[0]);
  }

  /* ================= 绕口令 ================= */
  function renderTwisters(container) {
    let filter = 0; // 0=全部
    let current = App.pick(D.TONGUE_TWISTERS);

    const wrap = App.el(
      '<div>' +
      '<div class="tabs">' +
      '<button class="tab" data-lv="0">全部</button>' +
      '<button class="tab" data-lv="1">初级</button>' +
      '<button class="tab" data-lv="2">进阶</button>' +
      '<button class="tab" data-lv="3">挑战</button>' +
      '<button class="btn primary sm" id="tw-next" style="margin-left:auto">🎲 换一个</button>' +
      '</div>' +
      '<div class="card" id="tw-card"></div>' +
      '<div id="tw-practice" class="mt"></div>' +
      '</div>'
    );
    container.appendChild(wrap);

    const cardEl = wrap.querySelector('#tw-card');
    const pracEl = wrap.querySelector('#tw-practice');
    let panel = null;

    function draw() {
      const pool = filter ? D.TONGUE_TWISTERS.filter(t => t.level === filter) : D.TONGUE_TWISTERS;
      current = App.pick(pool.length ? pool : D.TONGUE_TWISTERS);
      show();
    }

    function show() {
      if (panel) { panel.destroy(); panel = null; }
      pracEl.innerHTML = '';
      cardEl.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span class="badge lv' + current.level + '">' + LV_NAME[current.level] + '</span>' +
        '<span class="focus-tag">🎯 训练重点：' + current.focus + '</span>' +
        '</div>' +
        '<div class="display-text mt">' + App.esc(current.text) + '</div>' +
        glossHTML(current.gloss) +
        '<div class="peek-note mt">💡 ' + App.esc(current.tip) + '</div>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn soft" id="tw-listen">🎧 听示范</button>' +
        '<button class="btn primary" id="tw-start">🎤 挑战一下</button>' +
        '<button class="btn ghost" id="tw-drill">🔁 逐句跟读</button>' +
        '</div>';

      cardEl.querySelector('#tw-listen').addEventListener('click', () => {
        SpeechKit.TTS.speak(current.text.replace(/[，。、]/g, '，'));
        App.toast('正在播放示范朗读');
      });
      cardEl.querySelector('#tw-drill').addEventListener('click', () => {
        const sents = Analyzer.splitClauses(current.text);
        startDrill(pracEl, sents, {
          title: '跟读 · ' + LV_NAME[current.level] + '绕口令',
          onExit: show
        });
      });
      cardEl.querySelector('#tw-start').addEventListener('click', () => {
        panel = App.createVoicePanel({ placeholder: '点击麦克风，用最快且清晰的速度读出这段绕口令……' });
        pracEl.innerHTML = '';
        pracEl.appendChild(panel.root);
        const bar = App.el(
          '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn primary" id="tw-done">✅ 完成挑战</button>' +
          '<button class="btn ghost" id="tw-cancel">收起</button>' +
          '</div>'
        );
        pracEl.appendChild(bar);
        bar.querySelector('#tw-done').addEventListener('click', () => {
          const txt = panel.getText();
          if (!txt) { App.toast('先录一段或输入文字再挑战哦', 'warn'); return; }
          const sim = Analyzer.similarity(current.text, txt);
          const pct = Math.round(sim * 100);
          const secs = Math.max(1, panel.seconds() || Math.round(txt.length / 4));
          const speed = Math.round(txt.replace(/\s/g, '').length / secs * 60);
          App.history.add({ module: 'warmup', title: '绕口令 · ' + LV_NAME[current.level], score: pct });
          panel.destroy(); panel = null;

          const advice = pct >= 88
            ? '非常出色！口齿清晰度已达标，可以挑战更高难度。'
            : pct >= 72
              ? '整体不错。建议先放慢到 80% 速度，把咬字不准的字单独读五遍，再提速。'
              : '别急——绕口令的关键是"先准后快"。逐句慢读，每个字读到位，分数会稳步上升。';
          pracEl.innerHTML =
            '<div class="card">' +
            '<div class="result-top">' + App.ringHTML(pct, '#d97706') +
            '<div class="result-brief"><div class="headline">' + stars(pct) + '</div>' +
            '<div class="dim-chips">' +
            '<span class="chip info">相似度 ' + pct + '%</span>' +
            '<span class="chip">用时 ' + App.fmtTime(secs) + '</span>' +
            '<span class="chip">语速约 ' + speed + ' 字/分</span>' +
            (speed > 300 ? '<span class="chip warn">语速偏快，注意咬字</span>' : speed < 120 ? '<span class="chip warn">语速偏慢</span>' : '<span class="chip ok">语速适中</span>') +
            '</div><p class="mt-sm" style="font-size:13.5px;color:#6b7280">' + advice + '</p></div></div>' +
            '<div class="divider"></div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<button class="btn soft" id="tw-again">🔁 再试一次</button>' +
            '<button class="btn ghost" id="tw-new">🎲 换一个</button>' +
            '</div></div>';
          pracEl.querySelector('#tw-again').addEventListener('click', () => { cardEl.querySelector('#tw-start').click(); });
          pracEl.querySelector('#tw-new').addEventListener('click', draw);
          App.animateRings(pracEl);
        });
        bar.querySelector('#tw-cancel').addEventListener('click', () => {
          panel.destroy(); panel = null; pracEl.innerHTML = '';
        });
      });
    }

    wrap.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        wrap.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        filter = parseInt(t.getAttribute('data-lv'), 10);
        draw();
      });
    });
    wrap.querySelector('#tw-next').addEventListener('click', draw);
    wrap.querySelector('.tab[data-lv="0"]').classList.add('active');
    show();
  }

  /* ============ 成语错题本 ============ */
  function renderWrongbook(box) {
    if (!box) return;
    const list = JSON.parse(localStorage.getItem('et_idiom_wrong') || '[]');
    if (!list.length) {
      box.innerHTML =
        '<div class="sec-title">📕 成语错题本</div>' +
        '<div class="peek-note">在「成语小测」里答错的成语会自动收进这里，方便集中复习；之后再答对会自动移出。</div>';
      return;
    }
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<div class="sec-title" style="margin:0">📕 成语错题本 <span class="chip bad">' + list.length + ' 个待复习</span></div>' +
      '<button class="btn ghost sm wb-clear">清空错题本</button></div>' +
      '<div class="mt-sm">' +
      list.map(x => '<div class="point-row"><span><b>' + App.esc(x.word) + '</b> — ' + App.esc(x.meaning) + '</span></div>').join('') +
      '</div>';
    box.querySelector('.wb-clear').addEventListener('click', () => {
      localStorage.removeItem('et_idiom_wrong');
      renderWrongbook(box);
      App.toast('错题本已清空', 'ok');
    });
  }

  /* ================= 成语充电 ================= */
  function renderIdioms(container) {
    let current = App.pick(D.IDIOMS);
    let quiz = null;

    const wrap = App.el('<div><div class="tabs"><button class="tab active" data-t="learn">📖 随机学一个</button><button class="tab" data-t="quiz">✏️ 成语小测</button></div><div id="idiom-body"></div></div>');
    container.appendChild(wrap);
    const body = wrap.querySelector('#idiom-body');

    function showLearn() {
      if (quiz) { quiz = null; }
      body.innerHTML =
        '<div class="grid cols-2">' +
        '<div class="card idiom-detail" id="idiom-detail"></div>' +
        '<div class="card"><div class="sec-title">📚 成语速查 <span class="chip">点击查看释义</span></div><div class="idiom-grid" id="idiom-grid"></div></div>' +
        '</div>' +
        '<div class="card mt" id="wrongbook-card"></div>';
      const detail = body.querySelector('#idiom-detail');
      const grid = body.querySelector('#idiom-grid');
      renderWrongbook(body.querySelector('#wrongbook-card'));
      D.IDIOMS.forEach(it => {
        const cell = App.el('<div class="idiom-cell">' + it.word + '</div>');
        cell.addEventListener('click', () => {
          current = it;
          fill();
          body.querySelectorAll('.idiom-cell').forEach(c => c.classList.remove('current'));
          cell.classList.add('current');
        });
        grid.appendChild(cell);
      });
      function fill() {
        detail.innerHTML =
          '<div><span class="word">' + current.word + '</span><span class="pinyin">' + current.pinyin + '</span></div>' +
          '<dl>' +
          '<dt>📖 释义</dt><dd>' + App.esc(current.meaning) + '</dd>' +
          '<dt>📜 出处</dt><dd>' + App.esc(current.origin) + '</dd>' +
          '<dt>✍️ 例句</dt><dd>' + App.esc(current.example) + '</dd>' +
          '<dt>🎙️ 表达场景应用</dt><dd>' + App.esc(current.tip) + '</dd>' +
          '</dl>' +
          '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn primary" id="idiom-next">🎲 再来一个</button>' +
          '<button class="btn soft" id="idiom-read">🎧 听读音</button>' +
          '</div>';
        detail.querySelector('#idiom-next').addEventListener('click', () => {
          current = App.pick(D.IDIOMS);
          fill();
          body.querySelectorAll('.idiom-cell').forEach(c => c.classList.toggle('current', c.textContent === current.word));
          body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        detail.querySelector('#idiom-read').addEventListener('click', () => {
          SpeechKit.TTS.speak(current.word + '。' + current.meaning);
        });
      }
      fill();
    }

    function showQuiz() {
      let q = null, streak = 0, best = 0, answered = false;
      body.innerHTML =
        '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
        '<div class="sec-title" style="margin:0">✏️ 看成语，选释义</div>' +
        '<div><span class="chip info" id="qz-streak">连对 ' + streak + '</span> <span class="chip" id="qz-best">最佳 ' + best + '</span></div>' +
        '</div>' +
        '<div class="quiz-q" id="quiz-q"></div><div id="quiz-opts"></div>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="quiz-next">下一题 →</button>' +
        '</div><div class="peek-note mt-sm">选择后立即判分；答错会显示正确释义。答完点"下一题"继续。</div>' +
        '</div>';

      function newQ() {
        answered = false;
        q = App.pick(D.IDIOMS);
        const wrongs = [];
        while (wrongs.length < 3) {
          const w = App.pick(D.IDIOMS);
          if (w.word !== q.word && wrongs.indexOf(w) < 0) wrongs.push(w);
        }
        const opts = wrongs.concat([q]).sort(() => Math.random() - 0.5);
        body.querySelector('#quiz-q').textContent = '「' + q.word + '」';
        const optsEl = body.querySelector('#quiz-opts');
        optsEl.innerHTML = '';
        opts.forEach(o => {
          const b = App.el('<button class="quiz-option">' + App.esc(o.meaning) + '</button>');
          b.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            const ok = o.word === q.word;
            if (ok) {
              streak++; best = Math.max(best, streak);
              b.classList.add('correct');
              // 答对了就从错题本移除
              const wb = JSON.parse(localStorage.getItem('et_idiom_wrong') || '[]').filter(x => x.word !== q.word);
              localStorage.setItem('et_idiom_wrong', JSON.stringify(wb));
              App.history.add({ module: 'warmup', title: '成语小测 · ' + q.word, score: 100 });
              App.toast('答对了！' + q.word + '：' + q.meaning.slice(0, 18) + '…', 'ok');
            } else {
              streak = 0;
              b.classList.add('wrong');
              optsEl.querySelectorAll('.quiz-option').forEach(x => {
                if (x.textContent === q.meaning) x.classList.add('correct');
              });
              // 收进错题本
              const wb = JSON.parse(localStorage.getItem('et_idiom_wrong') || '[]');
              if (!wb.some(x => x.word === q.word)) wb.push({ word: q.word, meaning: q.meaning });
              localStorage.setItem('et_idiom_wrong', JSON.stringify(wb.slice(-30)));
              App.toast('正确答案：' + q.meaning, 'warn');
            }
            body.querySelector('#qz-streak').textContent = '连对 ' + streak;
            body.querySelector('#qz-best').textContent = '最佳 ' + best;
          });
          optsEl.appendChild(b);
        });
      }
      body.querySelector('#quiz-next').addEventListener('click', newQ);
      newQ();
    }

    wrap.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        wrap.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        t.getAttribute('data-t') === 'learn' ? showLearn() : showQuiz();
      });
    });
    showLearn();
  }

  /* ================= 美文朗读 ================= */
  function renderReading(container) {
    let current = App.pick(D.PASSAGES);

    container.appendChild(App.el(
      '<div><div class="card" id="read-card"></div><div id="read-practice" class="mt"></div></div>'
    ));
    const cardEl = container.querySelector('#read-card');
    const pracEl = container.querySelector('#read-practice');
    let panel = null;

    function draw() {
      current = App.pick(D.PASSAGES);
      show();
    }

    function show() {
      if (panel) { panel.destroy(); panel = null; }
      pracEl.innerHTML = '';
      cardEl.innerHTML =
        '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">' +
        '<h2 style="font-size:22px">《' + current.title + '》</h2>' +
        '<span class="chip">' + App.esc(current.author) + '</span>' +
        '</div>' +
        '<div class="passage-text mt">' + App.esc(current.text) + '</div>' +
        glossHTML(current.gloss) +
        '<div class="divider"></div>' +
        '<div class="sec-title">💡 朗读提示</div>' +
        '<ul class="read-tips">' + current.tips.map(t => '<li>' + App.esc(t) + '</li>').join('') + '</ul>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn soft" id="read-listen">🎧 听范读</button>' +
        '<button class="btn primary" id="read-start">🎤 开始朗读</button>' +
        '<button class="btn ghost" id="read-drill">🔁 逐句跟读</button>' +
        '<button class="btn ghost" id="read-next">📜 换一篇</button>' +
        '</div>';

      cardEl.querySelector('#read-listen').addEventListener('click', () => {
        SpeechKit.TTS.speak(current.text);
        App.toast('正在播放范读（TTS 合成，仅供节奏参考）');
      });
      cardEl.querySelector('#read-drill').addEventListener('click', () => {
        const sents = [];
        current.text.split(/\n+/).forEach(line => {
          line.split(/[。！？；]+/).map(s => s.trim()).filter(s => s.replace(/\s/g, '').length >= 2).forEach(s => sents.push(s));
        });
        startDrill(pracEl, sents, {
          title: '跟读 · ' + current.title,
          onExit: show
        });
      });
      cardEl.querySelector('#read-next').addEventListener('click', draw);
      cardEl.querySelector('#read-start').addEventListener('click', () => {
        panel = App.createVoicePanel({ placeholder: '点击麦克风，按朗读提示有感情地朗读这篇文章……' });
        pracEl.innerHTML = '';
        pracEl.appendChild(panel.root);
        const bar = App.el(
          '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn primary" id="read-done">✅ 完成朗读</button>' +
          '<button class="btn ghost" id="read-cancel">收起</button>' +
          '</div>'
        );
        pracEl.appendChild(bar);

        bar.querySelector('#read-done').addEventListener('click', () => {
          const txt = panel.getText();
          if (!txt) { App.toast('先录一段或输入文字哦', 'warn'); return; }
          const pct = Math.round(Analyzer.similarity(current.text, txt) * 100);
          const secs = Math.max(1, panel.seconds() || 30);
          const chars = txt.replace(/\s/g, '').length;
          const speed = Math.round(chars / secs * 60);
          App.history.add({ module: 'warmup', title: '朗读 · ' + current.title, score: pct });
          panel.destroy(); panel = null;

          const advice = pct >= 85
            ? '字词完整度和流畅度都很好。下一步练习重音与停顿，让朗读更有感染力。'
            : pct >= 65
              ? '整体流畅，个别字词有遗漏或识别偏差。可以对照原文，把出错的那几句单独读三遍。'
              : '别灰心——识别率低也可能是语速过快或声音偏轻。放慢、放开声音再试一次，分数通常明显提升。';
          pracEl.innerHTML =
            '<div class="card">' +
            '<div class="result-top">' + App.ringHTML(pct, '#0d9488') +
            '<div class="result-brief"><div class="headline">' + stars(pct) + '</div>' +
            '<div class="dim-chips">' +
            '<span class="chip info">完整度 ' + pct + '%</span>' +
            '<span class="chip">用时 ' + App.fmtTime(secs) + '</span>' +
            '<span class="chip">语速 ' + speed + ' 字/分</span>' +
            (speed > 260 ? '<span class="chip warn">偏快：朗读建议 180~240 字/分</span>' : speed < 130 ? '<span class="chip warn">偏慢：注意语流连贯</span>' : '<span class="chip ok">语速在朗读区间 ✔</span>') +
            '</div><p class="mt-sm" style="font-size:13.5px;color:#6b7280">' + advice + '</p></div></div>' +
            '<div class="divider"></div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<button class="btn soft" id="read-again">🔁 再读一次</button>' +
            '<button class="btn ghost" id="read-new2">📜 换一篇</button>' +
            '</div></div>';
          pracEl.querySelector('#read-again').addEventListener('click', () => cardEl.querySelector('#read-start').click());
          pracEl.querySelector('#read-new2').addEventListener('click', draw);
          App.animateRings(pracEl);
        });
        bar.querySelector('#read-cancel').addEventListener('click', () => {
          panel.destroy(); panel = null; pracEl.innerHTML = '';
        });
      });
    }

    show();
  }

  /* ================= 模块入口 ================= */
  App.register('warmup', function (root) {
    root.innerHTML =
      '<div class="page-head"><div><h1>🔥 朗读热身</h1><div class="sub">开口前的三分钟：绕口令活动口齿，成语补充弹药，美文唤醒语感。</div></div></div>' +
      '<div class="tabs" id="warmup-tabs">' +
      '<button class="tab active" data-t="tw">绕口令</button>' +
      '<button class="tab" data-t="idiom">成语充电</button>' +
      '<button class="tab" data-t="read">美文朗读</button>' +
      '</div><div id="warmup-body"></div>';
    const body = root.querySelector('#warmup-body');
    const tabs = root.querySelector('#warmup-tabs');
    const views = { tw: renderTwisters, idiom: renderIdioms, read: renderReading };
    tabs.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        tabs.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        App.destroyPanels();
        SpeechKit.TTS.stop();
        body.innerHTML = '';
        views[t.getAttribute('data-t')](body);
      });
    });
    renderTwisters(body);
  });

})();
