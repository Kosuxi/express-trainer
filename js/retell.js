/* ============================================================
 * 模块三：复述训练
 * 随机科普短文 → 阅读 → 隐藏原文复述 → 要点覆盖/结构分析
 * ============================================================ */
(function () {

  App.register('retell', function (root) {
    root.innerHTML =
      '<div class="page-head"><div><h1>🔁 复述训练</h1><div class="sub">随机一篇科普短文，读完后合上原文复述，检验你的信息提取与结构化表达能力。</div></div></div>' +
      '<div id="retell-body"></div>';
    const body = root.querySelector('#retell-body');

    let article = null;
    let peeks = 0;
    let phase = 'read'; // read | retell
    let panel = null;
    let retellMode = 'read'; // read | listen
    let plays = 0;

    /* ---------- 阅读阶段 ---------- */
    function showRead(newArticle) {
      if (newArticle) article = App.pick(ET_CONTENT.ARTICLES);
      peeks = 0; phase = 'read';
      if (panel) { panel.destroy(); panel = null; }

      body.innerHTML =
        '<div class="card">' +
        '<div class="article-meta">' +
        '<span class="badge theme-retell">科普短文</span>' +
        '<h2 style="font-size:21px">《' + article.title + '》</h2>' +
        '<span class="chip">约 ' + article.text.replace(/\s/g, '').length + ' 字 · 1 分钟读完</span>' +
        '</div>' +
        '<div class="article-text" id="article-text">' + App.esc(article.text) + '</div>' +
        '<div class="divider"></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn primary" id="rt-start">✅ 我读完了，开始复述</button>' +
        '<button class="btn warn" id="rt-listen-mode">🎧 听读模式（不看文本）</button>' +
        '<button class="btn ghost" id="rt-next">🎲 换一篇</button>' +
        '<button class="btn soft" id="rt-listen">🔊 朗读全文</button>' +
        '</div>' +
        '<div class="peek-note mt-sm">建议出声读一遍 + 默读一遍，抓住"开头讲什么、中间几个要点、结尾怎么收"再开始。<br>' +
        '🎧 <b>听读模式</b>：不看文本，只听一遍播报就复述——最接近开会听汇报的真实场景。</div>' +
        '</div>' +
        '<div id="rt-practice" class="mt"></div>';

      body.querySelector('#rt-next').addEventListener('click', () => showRead(true));
      body.querySelector('#rt-listen').addEventListener('click', () => {
        SpeechKit.TTS.speak(article.text);
        App.toast('正在朗读全文');
      });
      body.querySelector('#rt-listen-mode').addEventListener('click', showListenMode);
      body.querySelector('#rt-start').addEventListener('click', () => showRetell('read'));
    }

    /* ---------- 听读模式：隐藏原文，播报一遍 ---------- */
    function showListenMode() {
      App.destroyPanels();
      body.innerHTML =
        '<div class="card">' +
        '<div class="article-meta">' +
        '<span class="badge theme-retell">🎧 听读模式</span>' +
        '<h2 style="font-size:21px">《' + article.title + '》</h2>' +
        '</div>' +
        '<p style="font-size:14.5px;color:#4b5563">原文已隐藏。点击播放，用耳朵听一遍（约 1 分钟），播完后凭记忆复述全文。建议拿出纸笔速记关键词——就像开会记纪要一样。</p>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn primary" id="rt-play">▶ 播放短文</button>' +
        '<button class="btn ghost" id="rt-back-read">← 返回看原文</button>' +
        '</div>' +
        '<div class="peek-note mt-sm" id="rt-play-state">每段短文只建议听 1~2 遍：听太多遍就成了听写，复述的训练价值会下降。</div>' +
        '</div>';
      body.querySelector('#rt-back-read').addEventListener('click', () => showRead(false));
      body.querySelector('#rt-play').addEventListener('click', function () {
        this.disabled = true;
        this.textContent = '🔊 播报中…';
        const stateEl = body.querySelector('#rt-play-state');
        stateEl.textContent = '正在播报，请认真听……听完（或想提前开始）就点下方按钮。';
        plays++;
        SpeechKit.TTS.speak(article.text, () => {
          const holder = body.querySelector('.card');
          if (!holder) return;
          stateEl.textContent = '播报结束（已播 ' + plays + ' 遍）。深呼吸，组织一下开头和要点，就开始吧。';
        });
        // 播报开始后即允许进入复述（播完会更新提示语）
        setTimeout(() => {
          const holder = body.querySelector('.card');
          if (!holder || document.getElementById('rt-listen-start')) return;
          const startBtn = App.el('<button class="btn primary mt" id="rt-listen-start" style="display:block">🎙️ 我听完了，开始复述</button>');
          holder.appendChild(startBtn);
          startBtn.addEventListener('click', () => showRetell('listen'));
        }, 600);
      });
    }

    /* ---------- 复述阶段 ---------- */
    function showRetell(mode) {
      App.destroyPanels();
      phase = 'retell';
      retellMode = mode || 'read';
      peeks = 0;

      body.innerHTML =
        '<div class="card">' +
        '<div class="article-meta">' +
        '<span class="badge theme-retell">' + (retellMode === 'listen' ? '🎧 听读复述' : '科普短文') + '</span>' +
        '<h2 style="font-size:21px">《' + article.title + '》</h2>' +
        (retellMode === 'listen' ? '<span class="chip info">凭听力复述</span>' : '') +
        '</div>' +
        '<div class="article-text" id="article-text" style="display:none">' + App.esc(article.text) + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn primary" id="rt-finish">✅ 复述完成，开始分析</button>' +
        '<button class="btn ghost" id="rt-peek">👁 偷看一眼原文</button>' +
        '<button class="btn ghost" id="rt-restart">← 重新准备</button>' +
        '<span class="peek-note">凭理解和记忆复述，偷看会被记录并扣分哦</span>' +
        '</div></div>' +
        '<div id="rt-practice" class="mt"></div>';

      const practice = body.querySelector('#rt-practice');
      practice.innerHTML = '<div class="peek-note" style="margin:0 0 10px">' +
        (retellMode === 'listen'
          ? '听读模式：用耳朵记住的内容，按"主题 → 要点 → 收尾"的顺序讲 30~60 秒。'
          : '原文已隐藏。用自己的话讲清楚这篇文章：先说主题，再按顺序讲要点，最后收个尾。') +
        '</div>';
      panel = App.createVoicePanel({ placeholder: '点击麦克风，用 30~60 秒复述这篇文章讲了什么……' });
      practice.appendChild(panel.root);

      const peekBtn = body.querySelector('#rt-peek');
      peekBtn.addEventListener('click', () => {
        const t = body.querySelector('#article-text');
        if (t.style.display === 'none') {
          peeks++;
          t.style.display = 'block';
          App.toast('偷看第 ' + peeks + ' 次（分析时会体现 😏）', 'warn');
          peekBtn.textContent = '🙈 收起原文';
        } else {
          t.style.display = 'none';
          peekBtn.textContent = '👁 偷看一眼原文';
        }
      });
      body.querySelector('#rt-restart').addEventListener('click', () => {
        retellMode === 'listen' ? showListenMode() : showRead(false);
      });
      body.querySelector('#rt-finish').addEventListener('click', () => {
        const text = panel.getText();
        if (!text) { App.toast('先说一段或输入文字再分析哦', 'warn'); return; }
        panel.destroy();
        showResult(text);
      });
    }

    /* ---------- 分析结果 ---------- */
    function showResult(text) {
      const r = Analyzer.analyzeRetell(article, text, peeks);
      App.history.add({ module: 'retell', title: (retellMode === 'listen' ? '🎧' : '') + article.title, score: r.score });

      body.innerHTML =
        '<div class="card">' +
        '<div class="result-top">' + App.ringHTML(r.score, '#0d9488') +
        '<div class="result-brief">' +
        '<div class="headline">' + r.level.stars + '　' + r.level.label + '</div>' +
        '<div class="dim-chips">' +
        '<span class="chip ' + (r.coverage >= 75 ? 'ok' : r.coverage >= 50 ? 'warn' : 'bad') + '">要点覆盖 ' + r.coverage + '%（' + r.points.filter(p => p.hit).length + '/' + r.points.length + '）</span>' +
        '<span class="chip ' + (r.openingOk ? 'ok' : 'bad') + '">' + (r.openingOk ? '✔' : '✘') + ' 开头点题</span>' +
        '<span class="chip ' + (r.closingOk ? 'ok' : 'bad') + '">' + (r.closingOk ? '✔' : '✘') + ' 结尾收束</span>' +
        '<span class="chip ' + (r.orderOk ? 'ok' : 'warn') + '">' + (r.orderOk ? '✔' : '✘') + ' 顺序清晰</span>' +
        '<span class="chip">篇幅为原文 ' + Math.round(r.ratio * 100) + '%</span>' +
        (retellMode === 'listen' ? '<span class="chip info">🎧 听读模式</span>' : '') +
        '</div></div></div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">🎯 要点覆盖明细</div><div id="rt-points"></div>' +
        '<div class="sec-title mt">✅ 做得好的地方</div><div id="rt-strengths"></div>' +
        '<div class="sec-title mt">⚠️ 不足与建议</div><div id="rt-weaknesses"></div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">📖 原文要点参考（复述时应覆盖）</div>' +
        '<div class="checklist">' +
        article.points.map((p, i) => '<div class="ck"><b>要点' + (i + 1) + '</b><span>' + App.esc(p.label) + '（关键词：' + p.keywords.map(k => '<span class="kw">' + App.esc(k) + '</span>').join(' ') + '）</span></div>').join('') +
        '</div>' +
        '<div class="sec-title mt">🗣️ 我的复述原文</div>' +
        '<div class="ref-answer" style="background:#f8f9fd;border-style:solid;border-color:#e7eaf3">' + App.esc(text) + '</div>' +
        '<div class="divider"></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="rt-again">🎲 再来一篇</button>' +
        '<button class="btn ghost" id="rt-retry">🔁 同篇重来</button>' +
        '</div></div>';

      const pBox = body.querySelector('#rt-points');
      r.points.forEach(p => {
        pBox.appendChild(App.el(
          '<div class="point-row ' + (p.hit ? 'hit' : 'miss') + '"><span class="pi">' + (p.hit ? '✔' : '✘') + '</span>' +
          '<span><b>' + App.esc(p.label) + '</b><br>' +
          (p.hit
            ? '你提到了：' + p.hits.map(k => '<span class="kw">' + App.esc(k) + '</span>').join(' ')
            : '未覆盖。相关关键词：' + p.keywords.slice(0, 3).map(k => '<span class="kw miss">' + App.esc(k) + '</span>').join(' ')) +
          '</span></div>'
        ));
      });

      const stBox = body.querySelector('#rt-strengths');
      (r.strengths.length ? r.strengths : [{ title: '暂未检测到明显亮点', text: '先按下面的建议补齐要点，复述质量会明显提升。' }])
        .forEach(s => stBox.appendChild(App.el('<div class="evidence"><b>' + App.esc(s.title) + '</b><br>' + App.esc(s.text) + '</div>')));
      const wkBox = body.querySelector('#rt-weaknesses');
      (r.weaknesses.length ? r.weaknesses : [{ title: '没有明显短板', text: '覆盖完整、结构清晰，可以挑战更长的文章了。' }])
        .forEach(s => wkBox.appendChild(App.el('<div class="weak-item"><b>' + App.esc(s.title) + '</b><br>' + App.esc(s.text) + '</div>')));

      body.querySelector('#rt-again').addEventListener('click', () => showRead(true));
      body.querySelector('#rt-retry').addEventListener('click', () => showRead(false));
      App.animateRings(body);
    }

    showRead(true);
  });

})();
