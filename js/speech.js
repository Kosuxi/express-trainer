/* ============================================================
 * 语音模块：语音识别（Web Speech API）+ 语音合成（TTS）
 * 识别器带自动重连：Chrome 长会话每 30~60 秒会断开一次流，
 * 瞬时错误（network 等）静默重启续录，不打断练习。
 * ============================================================ */
window.SpeechKit = (() => {

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;

  /* ---------- 语音识别封装 ---------- */
  class VoiceInput {
    /**
     * @param {Function} cb (finalText, interimText) 每次识别结果回调
     * @param {Function} onErr (code) 仅致命错误才回调：
     *        not-allowed / service-not-allowed 权限被拒
     *        audio-capture 无麦克风设备
     *        unstable 30 秒内连续失败超过 8 次（网络持续不稳）
     *        restart-fail 识别器无法重启
     */
    constructor(cb, onErr) {
      this.cb = cb || function () { };
      this.onErr = onErr || function () { };
      this.active = false;
      this.finalText = '';
      this.rec = null;
      this._session = 0;      // 会话号：stop/start 时递增，让旧实例的回调全部失效
      this._restarts = 0;     // 30 秒窗口内的自动重启次数
      this._windowStart = 0;
    }

    _create(session) {
      const rec = new SR();
      rec.lang = 'zh-CN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        if (session !== this._session) return;
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) this.finalText += t;
          else interim += t;
        }
        this.cb(this.finalText, interim);
      };
      rec.onerror = (e) => {
        if (session !== this._session || !this.active) return;
        const code = e.error;
        // 正常静默：短暂无语音 / 主动停止
        if (code === 'no-speech' || code === 'aborted') return;
        // 致命：权限被拒或没有麦克风设备
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
          this.active = false;
          this.onErr(code);
          return;
        }
        // 瞬时错误（network 等）：限流计数，由 onend 自动重启恢复
        const now = Date.now();
        if (now - this._windowStart > 30000) { this._windowStart = now; this._restarts = 0; }
        this._restarts++;
        if (this._restarts > 8) {
          this.active = false;
          this.onErr('unstable');
        }
      };
      rec.onend = () => {
        if (session !== this._session || !this.active) return;
        const delay = this._restarts > 0 ? 600 : 250;
        setTimeout(() => {
          if (session !== this._session || !this.active) return;
          try {
            this.rec.start();
          } catch (_) {
            // 实例尚未释放干净：换一个全新识别器重试
            setTimeout(() => {
              if (session !== this._session || !this.active) return;
              try {
                this.rec = this._create(session);
                this.rec.start();
              } catch (_) {
                this.active = false;
                this.onErr('restart-fail');
              }
            }, 700);
          }
        }, delay);
      };
      return rec;
    }

    start() {
      if (!supported) return;
      this.finalText = '';
      this.active = true;
      this._restarts = 0;
      this._windowStart = Date.now();
      this._session++;
      this.rec = this._create(this._session);
      try { this.rec.start(); } catch (_) { }
    }

    stop() {
      this._session++;          // 使旧实例的待触发回调失效
      this.active = false;
      if (this.rec) { try { this.rec.stop(); } catch (_) { } }
      this.rec = null;
    }

    destroy() { this.stop(); }
  }

  /* ---------- 语音合成 ---------- */
  const TTS = {
    enabled: true,
    voice: null,
    _pickVoice() {
      if (!window.speechSynthesis) return null;
      if (this.voice) return this.voice;
      const voices = window.speechSynthesis.getVoices() || [];
      const zh = voices.filter(v => /zh[-_]CN|Chinese/i.test(v.lang + v.name));
      this.voice = zh[0] || null;
      return this.voice;
    },
    speak(text, onend) {
      if (!this.enabled || !window.speechSynthesis || !text) {
        if (onend) setTimeout(onend, 300);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 0.98;
        const v = this._pickVoice();
        if (v) u.voice = v;
        if (onend) {
          u.onend = () => { try { onend(); } catch (_) { } };
          u.onerror = () => { try { onend(); } catch (_) { } };
        }
        window.speechSynthesis.speak(u);
      } catch (_) {
        if (onend) setTimeout(onend, 300);
      }
    },
    stop() {
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) { }
    }
  };
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => { TTS.voice = null; TTS._pickVoice(); };
  }

  /* ---------- 麦克风权限状态 ---------- */
  const MicPerm = {
    /** 返回 'granted' | 'denied' | 'prompt' | null（浏览器不支持查询） */
    state() {
      return new Promise(resolve => {
        if (!navigator.permissions || !navigator.permissions.query) { resolve(null); return; }
        try {
          navigator.permissions.query({ name: 'microphone' })
            .then(p => { resolve(p.state); })
            .catch(() => resolve(null));
        } catch (_) { resolve(null); }
      });
    }
  };

  return { supported, VoiceInput, TTS, MicPerm };
})();
