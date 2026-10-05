/* ============================================================
 * 模块四：临场说服
 * 随机场景 → 与对方多轮对话（逐轮即时反馈）→ 复盘评价 + 参考话术
 * ============================================================ */
(function () {

  /* 对方在你回应乏力时的追问池 */
  const FOLLOWUPS = [
    '你就拿这个说服我？再具体点。',
    '凭什么？给我个理由。',
    '我不太信，有依据吗？',
    '光说态度不行，落到细节讲讲。',
    '换个角度说说，我关心的可不是这个。',
    '然后呢？这跟我有什么关系？'
  ];

  App.register('persuade', function (root) {
    root.innerHTML =
      '<div class="page-head"><div><h1>🎯 临场说服</h1><div class="sub">随机抽取一个说服场景，与对方实时过招四轮。你说的每句话都会被即时分析：共情、利益、证据、让步、行动建议，一样都不能少。</div></div></div>' +
      '<div id="persuade-body"></div>';
    const body = root.querySelector('#persuade-body');

    let scenario = null;
    let round = 0;          // 当前第几轮异议（0~3）
    let userTurns = [];     // 用户每轮发言
    let finished = false;
    let panel = null;
    let ttsOn = true;

    /* ---------- 开始界面 ---------- */
    function showSetup() {
      App.destroyPanels();
      scenario = App.pick(ET_CONTENT.SCENARIOS);
      round = 0; userTurns = []; finished = false;

      body.innerHTML =
        '<div class="card scenario-head">' +
        '<span class="badge theme-persuade">场景 ' + ('0' + (ET_CONTENT.SCENARIOS.indexOf(scenario) + 1)).slice(-2) + '</span>' +
        '<h2 class="mt-sm">' + scenario.title + '</h2>' +
        '<div class="goal">📍 情境：' + App.esc(scenario.setting) + '</div>' +
        '<div class="goal">🎯 你的目标：' + App.esc(scenario.goal) + '</div>' +
        '<div class="persona-box">👤 <b>对方画像 · ' + App.esc(scenario.target) + '</b><br>' + App.esc(scenario.persona) + '<br>' +
        '对方核心关切：<b>' + scenario.focus.join(' / ') + '</b></div>' +
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="ps-start">⚔️ 进入对话</button>' +
        '<button class="btn ghost" id="ps-change">🎲 换个场景</button>' +
        '</div></div>';

      body.querySelector('#ps-change').addEventListener('click', showSetup);
      body.querySelector('#ps-start').addEventListener('click', showChat);
    }

    /* ---------- 对话界面 ---------- */
    function showChat() {
      App.destroyPanels();
      round = 0; userTurns = []; finished = false;
      body.innerHTML =
        '<div class="card scenario-head" style="padding:16px 20px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<div><b style="font-size:17px">' + scenario.title + '</b>' +
        '<span class="chip warn" id="ps-round" style="margin-left:10px">第 1 / ' + scenario.objections.length + ' 轮</span></div>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="btn ghost sm" id="ps-tts">🔊 语音播放：开</button>' +
        '<button class="btn ghost sm" id="ps-quit">↩ 换场景</button>' +
        '</div></div></div>' +
        '<div class="chat-box mt" id="chat-box"></div>' +
        '<div id="ps-input" class="mt"></div>';

      const chat = body.querySelector('#chat-box');
      SpeechKit.TTS.enabled = ttsOn;

      function addMsg(who, text, opts) {
        opts = opts || {};
        const name = who === 'me' ? '你' : who === 'sys' ? '' : scenario.target;
        const m = App.el('<div class="msg ' + (who === 'sys' ? 'sys' : who) + '"><div class="who">' + name + '</div>' + App.esc(text) + '</div>');
        chat.appendChild(m);
        if (opts.chips) {
          const chips = App.el('<div class="turn-chips">' + opts.chips + '</div>');
          chat.appendChild(chips);
        }
        chat.scrollTop = chat.scrollHeight;
        return m;
      }

      // 开场：系统说明 + 对方第一句话
      addMsg('sys', '💬 对话开始。说服对方时，记得综合运用：共情倾听 / 利益驱动 / 事实依据 / 让步折中 / 明确行动 / 尊重礼貌');
      addMsg('sys', '👤 对方已就位：' + scenario.target + '（' + scenario.persona + '）');
      setTimeout(() => {
        addMsg('them', scenario.objections[0]);
        SpeechKit.TTS.speak(scenario.objections[0]);
      }, 600);

      // 输入区
      panel = App.createVoicePanel({ placeholder: '点击麦克风回应对方，或直接打字……每轮建议 2~4 句话。' });
      const input = body.querySelector('#ps-input');
      input.appendChild(panel.root);
      const bar = App.el(
        '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="ps-send">📨 回应对方</button>' +
        '<button class="btn ghost" id="ps-end" disabled>🏁 结束对话，查看复盘</button>' +
        '<span class="peek-note" id="ps-turn-count">已回应 0 轮（建议完成 4 轮）</span>' +
        '</div>'
      );
      input.appendChild(bar);

      body.querySelector('#ps-tts').addEventListener('click', function () {
        ttsOn = !ttsOn;
        SpeechKit.TTS.enabled = ttsOn;
        if (!ttsOn) SpeechKit.TTS.stop();
        this.textContent = ttsOn ? '🔊 语音播放：开' : '🔇 语音播放：关';
      });
      body.querySelector('#ps-quit').addEventListener('click', () => { showSetup(); });

      const sendBtn = body.querySelector('#ps-send');
      const endBtn = body.querySelector('#ps-end');

      sendBtn.addEventListener('click', () => {
        if (finished) return;
        const text = panel.getText();
        if (!text) { App.toast('先说点什么回应对方吧', 'warn'); return; }
        panel.clear();

        // 即时反馈本轮技巧运用
        const dims = Analyzer.analyzePersuasionTurn(text);
        const chips = dims.map(d =>
          '<span class="chip ' + (d.count ? 'ok' : '') + '">' + (d.count ? '✔' : '○') + d.label + (d.count > 1 ? '×' + d.count : '') + '</span>'
        ).join('');
        addMsg('me', text, { chips });
        userTurns.push(text);

        const turnCount = userTurns.length;
        body.querySelector('#ps-turn-count').textContent = '已回应 ' + turnCount + ' 轮（建议完成 ' + scenario.objections.length + ' 轮）';
        if (turnCount >= 2) endBtn.disabled = false;

        // 对方回应
        const typing = App.el('<div class="typing">对方正在输入…</div>');
        chat.appendChild(typing);
        chat.scrollTop = chat.scrollHeight;
        sendBtn.disabled = true;

        setTimeout(() => {
          typing.remove();
          const goodTurn = dims.filter(d => d.count > 0).length >= 2;
          round++;
          let reply;
          if (round < scenario.objections.length) {
            const lead = goodTurn ? scenario.softReactions[round - 1] : scenario.resistReactions[round - 1];
            reply = lead + ' ' + scenario.objections[round];
            if (!goodTurn && Math.random() < 0.6) {
              reply += ' ' + FOLLOWUPS[Math.floor(Math.random() * FOLLOWUPS.length)];
            }
            body.querySelector('#ps-round').textContent = '第 ' + (round + 1) + ' / ' + scenario.objections.length + ' 轮';
          } else {
            // 最后一轮：根据整体表现决定结局
            const pre = Analyzer.analyzePersuasionOverall(userTurns, scenario);
            reply = (goodTurn ? scenario.softReactions[round - 1] : scenario.resistReactions[round - 1]) + ' ' + scenario.accept[pre.outcome];
            finished = true;
            sendBtn.disabled = true;
            endBtn.disabled = false;
            endBtn.classList.remove('ghost');
            endBtn.classList.add('primary');
            addMsg('them', reply);
            SpeechKit.TTS.speak(reply);
            addMsg('sys', '🎬 对话结束！点击「🏁 结束对话，查看复盘」查看你的表现分析。');
            return;
          }
          addMsg('them', reply);
          SpeechKit.TTS.speak(reply);
          sendBtn.disabled = false;
        }, 900 + Math.random() * 700);
      });

      endBtn.addEventListener('click', () => {
        if (userTurns.length < 2) { App.toast('至少完成两轮回应再复盘哦', 'warn'); return; }
        if (panel) { panel.destroy(); panel = null; }
        showResult();
      });
    }

    /* ---------- 复盘 ---------- */
    function showResult() {
      const r = Analyzer.analyzePersuasionOverall(userTurns, scenario);
      App.history.add({ module: 'persuade', title: scenario.title, score: r.score });

      body.innerHTML =
        '<div class="card">' +
        '<div class="result-top">' + App.ringHTML(r.score, '#e11d48') +
        '<div class="result-brief">' +
        '<div class="headline">' + r.outcomeText + '</div>' +
        '<div class="dim-chips">' + r.dims.map(d =>
          '<span class="chip ' + (d.gain >= d.weight ? 'ok' : d.gain > 0 ? 'warn' : 'bad') + '">' + d.label + ' ' + d.gain + '/' + d.weight + '</span>'
        ).join('') + '</div>' +
        '<div class="dim-chips">' +
        '<span class="chip">共 ' + userTurns.length + ' 轮回应</span>' +
        (r.focusHits.length ? '<span class="chip ok">切中关切：' + r.focusHits.slice(0, 4).join('、') + '</span>' : '<span class="chip bad">未切中对方关切</span>') +
        '</div></div></div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">✅ 做得好的地方</div><div id="ps-strengths"></div>' +
        '<div class="sec-title mt">⚠️ 不足与建议</div><div id="ps-weaknesses"></div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">📖 参考策略</div>' +
        '<div class="checklist">' + scenario.strategy.map((s, i) => '<div class="ck"><b>策略' + (i + 1) + '</b><span>' + App.esc(s) + '</span></div>').join('') + '</div>' +
        '<div class="sec-title mt">🎭 参考对话（示范版）</div>' +
        '<div class="ref-answer">' + scenario.sample.map(m =>
          (m.who === 'me' ? '🧑 你：' : '👤 ' + scenario.target + '：') + App.esc(m.line)
        ).join('\n') + '</div>' +
        '<div class="divider"></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" id="ps-again">🎲 再来一局</button>' +
        '<button class="btn ghost" id="ps-same">🔁 同场景重来</button>' +
        '</div></div>';

      const stBox = body.querySelector('#ps-strengths');
      (r.strengths.length ? r.strengths : [{ title: '暂未检测到明显亮点', text: '先按下面的建议补齐基础技巧。' }])
        .forEach(s => stBox.appendChild(App.el('<div class="evidence"><b>' + App.esc(s.title) + '</b><br>' + App.esc(s.text) + '</div>')));
      const wkBox = body.querySelector('#ps-weaknesses');
      (r.weaknesses.length ? r.weaknesses : [{ title: '没有明显短板', text: '技巧运用均衡，继续保持。' }])
        .forEach(s => wkBox.appendChild(App.el('<div class="weak-item"><b>' + App.esc(s.title) + '</b><br>' + App.esc(s.text) + '</div>')));

      body.querySelector('#ps-again').addEventListener('click', showSetup);
      body.querySelector('#ps-same').addEventListener('click', showChat);
      App.animateRings(body);
    }

    showSetup();
  });

})();
