/* ============================================================
 * 分析引擎：
 * - 文本工具（分句 / 口头禅 / 相似度）
 * - 六大表达框架的结构检测与评分
 * - 参考答案生成
 * - 复述分析 / 说服力分析
 * ============================================================ */
window.Analyzer = (() => {

  /* ================= 文本工具 ================= */

  function splitClauses(text) {
    return (text || '')
      .split(/[\n。！？!?；;，,、]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);
  }

  function stripForCompare(text) {
    return (text || '').replace(/[\s\u3000，。！？；、：,!?;:'"“”‘’（）()《》〈〉【】\[\]-—…·.]/g, '');
  }

  function bigrams(s) {
    const r = [];
    for (let i = 0; i < s.length - 1; i++) r.push(s.slice(i, i + 2));
    return r;
  }

  /** bigram Dice 相似度 0~1（用于朗读/绕口令比对） */
  function similarity(a, b) {
    const A = bigrams(stripForCompare(a));
    const B = bigrams(stripForCompare(b));
    if (!A.length || !B.length) return 0;
    const map = {};
    A.forEach(x => { map[x] = (map[x] || 0) + 1; });
    let inter = 0;
    B.forEach(x => { if (map[x] > 0) { inter++; map[x]--; } });
    return (2 * inter) / (A.length + B.length);
  }

  const FILLER_WORDS = ['然后', '就是', '那个', '这个', '嗯', '呃', '反正', '说实话'];
  function countFillers(text) {
    const res = [];
    FILLER_WORDS.forEach(w => {
      let c = 0, idx = 0;
      while ((idx = text.indexOf(w, idx)) !== -1) { c++; idx += w.length; }
      if (c >= 3) res.push({ w, c });
    });
    return res.sort((a, b) => b.c - a.c);
  }

  function countMatches(text, regexList) {
    let n = 0;
    regexList.forEach(re => {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      const m = text.match(g);
      if (m) n += m.length;
    });
    return n;
  }

  function levelOf(score) {
    if (score >= 85) return { label: '优秀', stars: '★★★' };
    if (score >= 70) return { label: '良好', stars: '★★☆' };
    if (score >= 55) return { label: '一般', stars: '★☆☆' };
    return { label: '待提升', stars: '☆☆☆' };
  }

  /* ================= 框架定义 ================= */
  const FRAMEWORKS = {
    prep: {
      name: 'PREP 法则',
      flow: ['观点 Point', '理由 Reason', '例子 Example', '重申观点 Point'],
      intro: '结论先行的万能结构，一分钟讲清一件事，即兴发言首选。',
      elements: [
        {
          key: 'P', label: 'P · 开门见山亮观点', weight: 30, where: 'head',
          patterns: [/我(?:认为|觉得|相信|建议|主张|倾向于)/, /(?:应该|应当|必须|最重要的是|关键在于|核心是)/, /我的(?:看法|观点|立场|建议|答案)是/, /我(?:支持|反对|推荐)/, /在我看来|依我看|要我说|我的想法/, /我(?:赞成|不(?:同意|赞成|觉得))|我的一贯看法/],
          tip: '第一、二句就亮明观点："我认为…… / 我建议……"，不要绕圈子铺垫。'
        },
        {
          key: 'R', label: 'R · 给出明确理由', weight: 25, where: 'any',
          patterns: [/因为|由于/, /首先|其次|再说|另外|一方面|第一[，、]?|第二[，、]?/, /(?:理由|原因)是/, /有助于|可以帮|这能|这会/, /再者|此外|而且|一来|二来|其二|毕竟|要知道/],
          tip: '用"因为…… / 首先……其次……"明确给出 1~2 个理由。'
        },
        {
          key: 'E', label: 'E · 举出具体例子', weight: 25, where: 'any',
          patterns: [/例如?|比如|打个比方|举个例子|拿.{1,10}来说/, /我(?:身边|上次|之前|朋友|同事|自己|认识)/, /就像|好比/, /据说|据统计|据报道|据我所知/, /有一次?|前几[天周]|上周|昨天|曾经|譬(?:如)?|比如说?/],
          tip: '加一个具体例子或亲身经历："比如上次……"，让观点可感。'
        },
        {
          key: 'P2', label: 'P · 结尾重申观点', weight: 20, where: 'tail',
          patterns: [/总之|综上|所以说|因此我|这就是为什么|说到底|归根结底/, /我(?:仍然|还是)?(?:认为|建议|相信)/, /回到.{0,10}(主题|问题|话题|这件事|本身)?/, /一句话|还是那句话|别忘了|记住|总(?:的来说|而言之)/, /^所以/],
          tip: '结尾回到观点："所以说……"，首尾呼应形成闭环。'
        }
      ]
    },

    pyramid: {
      name: '金字塔原理',
      flow: ['结论先行', '分层论据', '例证支撑', '总结回扣'],
      intro: '结论先行、以上统下、归类分组，汇报与正式表达的骨架。',
      elements: [
        {
          key: 'C', label: '结论先行（第一句给结论）', weight: 30, where: 'head',
          patterns: [/我的?(?:核心|最终)?(?:结论|建议|观点|答案)是/, /我认为|我建议|答案是|一句话[来说]/, /关键是|最重要的是|核心是/, /在我看来|要我说|我的判断(?:是)?/],
          tip: '第一句就给结论："我的结论是…… / 我建议……"。'
        },
        {
          key: 'A', label: '分层论据（首先/其次/第一第二）', weight: 28, where: 'any',
          patterns: [/首先/, /其次/, /再次/, /最后/, /第一[，、]/, /第二[，、]/, /第三[，、]/, /一方面|另一方面/],
          custom: (text) => {
            const marks = ['首先', '其次', '再次', '第一，', '第一、', '第二，', '第二、', '第三，', '第三、', '第四，', '第四、', '一方面', '此外', '再者', '最后'].filter(m => text.includes(m));
            return { matched: marks.length >= 2, note: '检测到 ' + marks.length + ' 个分层标记' };
          },
          tip: '论据分层展开："首先……其次……最后……"，让听众跟得上。'
        },
        {
          key: 'S', label: '论据充分（结构展开）', weight: 20, where: 'any',
          patterns: [],
          custom: (text) => {
            const clauses = splitClauses(text);
            const ok = clauses.length >= 4;
            return { matched: ok, note: '共 ' + clauses.length + ' 个语句单元（建议≥4）' };
          },
          tip: '每个论据至少展开一句，避免只有观点没有内容。'
        },
        {
          key: 'E', label: '例证支撑', weight: 12, where: 'any',
          patterns: [/例如?|比如|举个例子|拿.{1,10}来说/, /我(?:上次|之前|身边|团队|公司)/, /数据|调查|研究|统计|调研|报告/],
          tip: '至少一个例子或数据，让金字塔不悬空。'
        },
        {
          key: 'T', label: '总结回扣结论', weight: 10, where: 'tail',
          patterns: [/总之|综上|所以|这就是|最终|归结|回到/, /总而言之|一句话|归根结底/],
          tip: '结尾回扣开头结论："总之，我的建议是……"。'
        }
      ]
    },

    scqa: {
      name: 'SCQA 模型',
      flow: ['情境 Situation', '冲突 Complication', '问题 Question', '答案 Answer'],
      intro: '讲故事式的开场结构，适合汇报开场、引出方案。',
      elements: [
        {
          key: 'S', label: 'S · 情境（大家熟悉的背景）', weight: 25, where: 'any',
          patterns: [/最近|如今|目前|现在|这几年|随着/, /大家都知道|现状|背景|日常/, /近年来|自从|说起|谈起|在很多(?:地方|场景|场合)/],
          tip: '先说一个大家都熟悉的情境："最近…… / 目前……"。'
        },
        {
          key: 'C', label: 'C · 冲突（打破预期的问题）', weight: 25, where: 'any',
          patterns: [/但是|然而|问题是|可惜|麻烦在于|尴尬的是|挑战|矛盾/, /却|偏偏|没想到/, /可是|遗憾的是|没想到的是|更大的问题是|压力(?:在于|是)/],
          tip: '用"但是…… / 问题是……"引出冲突，制造张力。'
        },
        {
          key: 'Q', label: 'Q · 问题（由此引出的疑问）', weight: 20, where: 'any',
          patterns: [/那么|怎么办|怎么解决/, /如何|怎样|怎么样|为什么/, /该[怎么怎]?[办么]/, /究竟|到底(?:怎么|如何|该)|出路(?:在|是)/],
          tip: '自然引出疑问："那么我们该怎么办？"'
        },
        {
          key: 'A', label: 'A · 答案（给出方案）', weight: 30, where: 'any',
          patterns: [/建议|方案|答案是|我们可以|不妨|应当/, /我的做法是|解决[方思路]/, /对策|办法是|出路是|我的方案|不妨先|先(?:要|得|从)/],
          tip: '给出答案："我的建议是…… / 我们可以……"，与冲突对应。'
        }
      ],
      orderCheck: true
    },

    compare: {
      name: '对比法',
      flow: ['一方观点/旧做法', '另一方观点/新做法', '反差强化', '结论'],
      intro: '用两个方案或前后状态的对照制造反差，推荐与说服的利器。',
      elements: [
        {
          key: 'S1', label: '呈现一方（常见做法 / 过去）', weight: 25, where: 'any',
          patterns: [/(?:以前|过去|传统|原来)的?/, /大多数人|很多人|别人|一般的做法/, /旧|老办法/, /从前|普通(?:做法|方案)|常见的?(?:做法|方式|思路)|按老(套路|规矩)/],
          tip: '先呈现一方：常见做法、过去的状况或别人的方案。'
        },
        {
          key: 'S2', label: '呈现另一方（新做法 / 我们）', weight: 25, where: 'any',
          patterns: [/现在|如今|而现在/, /相比之下|改进后|新的做法|我们(?:的方案|这边)/, /更好的(?:方式|做法)是/, /升级(?:后|版)|新(?:的|版)做法|换成|改用/],
          tip: '再呈现另一方："而现在的做法是…… / 相比之下……"。'
        },
        {
          key: 'X', label: '对比词凸显反差', weight: 25, where: 'any',
          patterns: [/而|相比之下/, /然而|反之|与此不同|不一样的是|差别在于/, /更(?:好|快|省|重要)|不如/, /相较(?:于)?|比起|相比|远(?:胜|超)|不及|反而/],
          tip: '用"而 / 相比之下 / 反之"把反差摆到台面上。'
        },
        {
          key: 'C', label: '结论（比较后收束）', weight: 25, where: 'tail',
          patterns: [/所以|因此|可见|综上/, /高下立判|差距|明显|一目了然/, /更值得|更应该/, /显然|毫无疑问|优劣/],
          tip: '比较完立刻收束："所以，……明显更值得选"。'
        }
      ]
    },

    fire: {
      name: 'FIRE 模型',
      flow: ['事实 Fact', '解读 Interpretation', '反应 Reaction', '期望 End'],
      intro: '基于事实的反馈模型，适合表达不满、给出反馈、提出期待。',
      elements: [
        {
          key: 'F', label: 'F · 先说事实', weight: 28, where: 'any',
          patterns: [/事实|数据|客观|实际[情况上是]/, /上周|昨天|这次|刚才|前天/, /先说[一]?个?(?:事实|情况)/, /客观(?:来)?说|实际情况?是?|先摆|坦白(?:说|讲)/],
          tip: '先摆事实不带评价："上周的例会迟到了十五分钟……"'
        },
        {
          key: 'I', label: 'I · 说出解读', weight: 24, where: 'any',
          patterns: [/我(?:认为|看来|的理解|觉得)/, /这意味着|换句话说|也就是说|这说明/, /在我看来|我的解读/, /我猜|恐怕|说不定|多半是|我的判断/],
          tip: '区分事实与解读："在我看来，这意味着……"'
        },
        {
          key: 'R', label: 'R · 表达感受/反应', weight: 24, where: 'any',
          patterns: [/我(?:感到|觉得)?(?:很)?(?:着急|担心|遗憾|不安|失望|无奈|难受)/, /让人|令我/, /我(?:的)?(?:感受|心情)|说实话我/, /我有点|挺(?:担心|着急|难受|失望)|坦率地讲/],
          tip: '坦率说出感受："这让我有点担心……"，而不是指责对方。'
        },
        {
          key: 'E', label: 'E · 提出期望', weight: 24, where: 'any',
          patterns: [/希望|期待|盼望/, /建议|需要|应当|接下来/, /我想要的是|我想请/, /以后(?:请)?|下不为例|拜托|麻烦你/],
          tip: '落到明确期望："我希望接下来……"，给出可执行的动作。'
        }
      ]
    },

    ride: {
      name: 'RIDE 模型',
      flow: ['风险 Risk', '利益 Interest', '差异 Difference', '影响 Effect'],
      intro: '说服序列：先讲不行动的风险，再讲收益、差异与影响。',
      elements: [
        {
          key: 'R', label: 'R · 不行动的风险', weight: 28, where: 'any',
          patterns: [/风险|如果不|一旦/, /后果|损失|错过|吃亏|代价|危险/, /再不|拖(?:下去|延)|越晚|等到(?:时候)?/],
          tip: '先讲不行动的风险："如果不……，就可能……"'
        },
        {
          key: 'I', label: 'I · 行动的利益', weight: 26, where: 'any',
          patterns: [/好处|收益|价值|利益/, /节省|省下|省时|提升|提高|赚|划算/, /一旦|做对了|能(?:省|赚|提升)|趁(?:现在|早)/],
          tip: '再讲收益："而这样做，可以省下…… / 提升……"'
        },
        {
          key: 'D', label: 'D · 与众不同的差异', weight: 22, where: 'any',
          patterns: [/不同|独特|差异|区别/, /与众不同|只有|独[家一无二]?|相比其他|特别的地方/, /别人|同行|常规|我们的区别|区别(?:在于|是)/],
          tip: '指出差异点："和常见做法不同的是……"'
        },
        {
          key: 'E', label: 'E · 客观的影响/代价', weight: 24, where: 'any',
          patterns: [/影响|副作用|代价|需要注意/, /当然|不过也要|提醒|因人而异|不是万能/],
          tip: '坦诚说明影响与代价，反而更可信："当然，它也有……"'
        }
      ]
    },

    star: {
      name: 'STAR 法则',
      flow: ['情境 Situation', '任务 Task', '行动 Action', '结果 Result'],
      intro: '讲经历、面试答题的黄金结构：背景—任务—行动—结果。',
      elements: [
        {
          key: 'S', label: 'S · 交代情境背景', weight: 22, where: 'any',
          patterns: [/当时|那次|去年|上个月|之前|有一次?/, /背景(?:是)?|正好赶上|项目.{0,8}(?:处于|期间)|刚接手/],
          tip: '开头一句话交代背景："当时我们正赶上……"'
        },
        {
          key: 'T', label: 'T · 说明任务目标', weight: 22, where: 'any',
          patterns: [/我的(?:任务|职责|目标)/, /需要(?:我)?(?:完成|解决|负责)|交给我|要求(?:我们)?|摆在(?:我)?面前/],
          tip: '说清你要完成什么："我的任务是在两周内……"'
        },
        {
          key: 'A', label: 'A · 描述具体行动', weight: 32, where: 'any',
          patterns: [/我(?:先|随后|接着|然后|决定|选择|采取|把|找|带)/, /第一步|于是|主动|协调|组织|拆解|梳理/],
          tip: '这是重心：分步骤讲你做了什么，"我先……然后……"，突出你自己的判断。'
        },
        {
          key: 'R', label: 'R · 呈现结果成果', weight: 24, where: 'any',
          patterns: [/最后|结果|最终|效果|成绩/, /提升|下降|节省|达成|完成|翻倍|按时|获得|满意度/, /从那以后|这件事让我|这段经历/],
          tip: '用数字或事实收尾："最终……提升了百分之……"，再点一句成长。'
        }
      ]
    },

    golden: {
      name: '黄金圈法则',
      flow: ['为什么 Why', '怎么做 How', '做什么 What'],
      intro: '由内而外打动人：先讲信念，再讲路径，最后讲成果。',
      elements: [
        {
          key: 'W', label: 'Why · 先讲为什么（信念）', weight: 36, where: 'any',
          patterns: [/为什么|初衷|初心|目的|意义|信念|动机/, /我们相信|我一直认为|最重要的问题是|一直在思考/],
          tip: '先回答"为什么做"："我们相信……"，而不是直接讲产品。'
        },
        {
          key: 'H', label: 'How · 再讲怎么做（路径）', weight: 32, where: 'any',
          patterns: [/怎么做|如何实现|通过|方式是|路径|凭借|靠着|原则(?:是)?/],
          tip: '讲实现路径："靠的是…… / 我们通过……来实现。"'
        },
        {
          key: 'A', label: 'What · 最后讲做什么（成果）', weight: 32, where: 'any',
          patterns: [/做了|推出|上线|打造|产品|成果|功能|做成(?:了)?/],
          tip: '最后落到具体成果："这就是我们做出来的……"'
        }
      ]
    },

    grow: {
      name: 'GROW 模型',
      flow: ['目标 Goal', '现状 Reality', '方案 Options', '行动 Will'],
      intro: '辅导与自我梳理的对话框架：目标—现状—选择—行动意愿。',
      elements: [
        {
          key: 'G', label: 'G · 明确目标', weight: 25, where: 'any',
          patterns: [/目标|想要(?:达成|达到|实现)|希望(?:达到|实现|做成)|这次要(?:解决|做到)/],
          tip: '先锚定目标："这次的目标是……"，越具体越好。'
        },
        {
          key: 'R', label: 'R · 描述现状', weight: 25, where: 'any',
          patterns: [/现状|目前|现实(?:是|情况)?|现在的情况|眼下|已经有|还缺/],
          tip: '客观描述现状与差距："目前的情况是……"，不评价不抱怨。'
        },
        {
          key: 'O', label: 'O · 列出方案选择', weight: 25, where: 'any',
          patterns: [/方案|选择|办法|可能性|可以(?:尝试|考虑)|备选|思路(?:是|有)?|一条?路(?:是)?/],
          tip: '列两三个可选方案："办法有三个：一是……"，让对方自己选。'
        },
        {
          key: 'W', label: 'W · 确定行动意愿', weight: 25, where: 'any',
          patterns: [/决定|计划|下一步|我会|打算|先从.{0,8}做起|什么时候开始|那就这么定/],
          tip: '落到行动与承诺："我决定先从……做起，下周一开始。"'
        }
      ]
    },

    wwhw: {
      name: 'WWHW 法',
      flow: ['谁 Who', '什么事 What', '怎么办 How', '为什么 Why'],
      intro: '把一件事讲清楚的朴素四问：谁、什么事、怎么办、为什么。',
      elements: [
        {
          key: 'W1', label: 'Who · 交代人物', weight: 22, where: 'any',
          patterns: [/我们|我|团队|大家|他是|她是|同事|朋友|用户|孩子/],
          tip: '开头点出人物："我们团队 / 我朋友……"，让听者有代入感。'
        },
        {
          key: 'W2', label: 'What · 说清事件', weight: 26, where: 'any',
          patterns: [/发生了|遇到|事情(?:是)?|要做|搞(?:了|个)|参加|经历/],
          tip: '一句话说清发生了什么，不绕弯。'
        },
        {
          key: 'H', label: 'How · 讲述过程', weight: 26, where: 'any',
          patterns: [/然后|接着|于是|通过|最后/, /先.{1,12}再|第一步|随后|后来/],
          tip: '按顺序讲清楚怎么推进的，步骤之间用"然后/接着"衔接。'
        },
        {
          key: 'W3', label: 'Why · 点出原因意义', weight: 26, where: 'any',
          patterns: [/为什么|原因|因为|目的|这让|意义|启发|明白(?:了)?|学到/],
          tip: '收尾回答为什么："这件事让我明白……"'
        }
      ]
    },

    funnel: {
      name: '沟通漏斗',
      flow: ['现象 衰减', '原因 丢失', '对策 确认', '呼吁 复述'],
      intro: '用"心里100%→行动20%"的衰减现象，论证沟通必须当场确认与反馈。',
      elements: [
        {
          key: 'P', label: '现象 · 描述衰减', weight: 26, where: 'any',
          patterns: [/漏斗|衰减|打折|递减|越传越/, /心里(?:想)?(?:的|是)|说出口|说出来|听到|理解|执行/],
          tip: '先讲现象："心里想的是百分之百，说出口只剩八成……"'
        },
        {
          key: 'C', label: '原因 · 指出丢失环节', weight: 26, where: 'any',
          patterns: [/原因|因为|丢(?:失|掉|在)|损耗|环节/, /没(?:说清|听懂|确认)|信息差|遗漏|误会/],
          tip: '指出在哪一环丢的："信息丢在没确认的那一步。"'
        },
        {
          key: 'A', label: '对策 · 给出确认方法', weight: 26, where: 'any',
          patterns: [/确认|复述|回放|反馈|对齐|当场问|闭环|白纸黑字|写下来/],
          tip: '给出对策："关键信息当场复述一遍、白纸黑字写下来。"'
        },
        {
          key: 'E', label: '呼吁 · 号召应用', weight: 22, where: 'any',
          patterns: [/希望大家|不妨|建议|从今天|下次|试一试|不妨试试|可以试试/],
          tip: '落到行动呼吁："下次布置任务，让对方复述一遍。"'
        }
      ]
    },

    scrtv: {
      name: 'SCRTV 模型',
      flow: ['情境 S', '冲突 C', '解决 R', '转机 T', '愿景 V'],
      intro: '汇报与复盘的结构：情境—冲突—解决—转机—愿景，把事故讲成转机。',
      elements: [
        {
          key: 'S', label: 'S · 情境', weight: 20, where: 'any',
          patterns: [/最近|目前|这个(?:月|季度|项目)|随着|上周|当天/],
          tip: '一句话客观交代背景情境。'
        },
        {
          key: 'C', label: 'C · 冲突', weight: 20, where: 'any',
          patterns: [/但是|问题|挑战|困难|风险|卡在|遇到|故障|事故/],
          tip: '直接指出出了什么问题，不遮掩。'
        },
        {
          key: 'R', label: 'R · 解决', weight: 24, where: 'any',
          patterns: [/我们(?:采取|做了|推出|启动)|解决(?:办法|方案)?|于是|通过|抢修|回滚/],
          tip: '讲清解决动作与时间线，体现掌控力。'
        },
        {
          key: 'T', label: 'T · 转机', weight: 18, where: 'any',
          patterns: [/转机|好转|改善|回升|见效|因祸得福|带来(?:了)?(?:变化|启发)|之后/],
          tip: '点出问题带来的转机与改变，用证据说话。'
        },
        {
          key: 'V', label: 'V · 愿景', weight: 18, where: 'any',
          patterns: [/未来|下一步|愿景|期待|相信|会(?:更|越来越)|把.{2,8}变成/],
          tip: '以愿景收尾："相信未来会……"，把听众的目光引向前方。'
        }
      ]
    },

    pdca: {
      name: 'PDCA 循环',
      flow: ['计划 Plan', '执行 Do', '检查 Check', '改进 Act'],
      intro: '持续改进的闭环叙述：计划—执行—检查—改进，让错误只犯一次。',
      elements: [
        {
          key: 'P', label: 'P · 计划', weight: 25, where: 'any',
          patterns: [/计划|规划|方案|安排|目标|打算|原定/],
          tip: '先还原当时的计划与假设："原计划是……"'
        },
        {
          key: 'D', label: 'D · 执行', weight: 25, where: 'any',
          patterns: [/执行|实施|开始做|落地|推进|做了|上线|开展/],
          tip: '讲怎么执行的，特别是与计划有出入的地方。'
        },
        {
          key: 'C', label: 'C · 检查', weight: 25, where: 'any',
          patterns: [/检查|复盘|核对|验证|结果(?:如何|显示)?|数据(?:显示)?|发现|确认/],
          tip: '用数据确认结果："复盘发现……"，根因要到流程层。'
        },
        {
          key: 'A', label: 'A · 改进', weight: 25, where: 'any',
          patterns: [/改进|修正|调整|优化|标准化|固化|沉淀|下(?:一)?(?:个)?(?:循环|次)|避免再|写进/],
          tip: '落在改进动作："把这套做法固化成清单，避免再犯。"'
        }
      ]
    },

    fivew: {
      name: '5W1H 法',
      flow: ['谁 Who', '何时 When', '何地 Where', '何事 What', '为何 Why', '如何 How'],
      intro: '信息完整性检查器：六个维度一个不漏，讲清任何事件。',
      elements: [
        { key: 'Who', label: 'Who · 谁', weight: 17, where: 'any', patterns: [/我们|我|他们|团队|同事|客户|用户|谁/], tip: '交代人物：谁做的、给谁做。' },
        { key: 'When', label: 'When · 何时', weight: 17, where: 'any', patterns: [/今天|昨天|上周|下周|下个月|最近|时候|时间|截止/], tip: '交代时间点与期限。' },
        { key: 'Where', label: 'Where · 何地', weight: 16, where: 'any', patterns: [/在公司|线上|现场|哪里|地点|会议室|渠道|平台|城市/], tip: '交代地点或渠道。' },
        { key: 'What', label: 'What · 何事', weight: 17, where: 'any', patterns: [/事情|事件|任务|项目|活动|要(?:做|开|办)|内容/], tip: '说清核心事项是什么。' },
        { key: 'Why', label: 'Why · 为何', weight: 17, where: 'any', patterns: [/因为|原因|目的|为了|动机|背景/], tip: '交代原因与目的。' },
        { key: 'How', label: 'How · 如何', weight: 16, where: 'any', patterns: [/怎么|如何|通过|步骤|流程|方式|方案/], tip: '讲清方法与步骤。' }
      ]
    },

    fivew2: {
      name: '5W2H 法',
      flow: ['五何 把事实讲全', 'How 怎么做', 'How much 花多少'],
      intro: '在 5W1H 基础上追加"多少"：方案与成本一并交代，布置任务不跑偏。',
      elements: [
        {
          key: 'W5', label: '5W · 事实六问', weight: 36, where: 'any',
          patterns: [],
          custom: (text) => {
            const dims = [/谁|人物/, /什么时候|何时|时间|今天|明天|下周|上周/, /哪里|地点|线上|现场|渠道/, /什么(?:事|项目|活动|任务)|做什么|内容/, /因为|为什么|目的|为了/, /怎么|如何/];
            const n = dims.filter(re => re.test(text)).length;
            return { matched: n >= 4, note: '覆盖 ' + n + '/6 个事实维度（建议≥4）' };
          },
          tip: '谁、何时、何地、何事、为何，事实维度至少覆盖四问。'
        },
        {
          key: 'H', label: 'How · 方法路径', weight: 32, where: 'any',
          patterns: [/怎么(?:做)?|如何|通过|步骤|流程|方式|方案|分三?步/],
          tip: '讲清执行方法与步骤。'
        },
        {
          key: 'H2', label: 'How much · 成本数量', weight: 32, where: 'any',
          patterns: [/多少|成本|预算|费用|花费|投入|几(?:个|天|次|周)|人天|万元|块|小时/],
          tip: '补上数量与成本："大约要三周、两万预算"，可执行性立刻不同。'
        }
      ]
    },

    fivewhys: {
      name: '5 Whys 五问法',
      flow: ['表象问题', '连环追问', '根因', '对策'],
      intro: '丰田根因分析法：连续追问为什么，直到挖出根本原因。',
      elements: [
        {
          key: 'Q', label: '追问 · 连续问为什么', weight: 34, where: 'any',
          patterns: [],
          custom: (text) => {
            const n = (text.match(/为什么/g) || []).length;
            return { matched: n >= 3, note: '检测到 ' + n + ' 次"为什么"（建议≥3）' };
          },
          tip: '连续追问至少三次"为什么"，一层一层往下挖，不要停在第一层答案。'
        },
        {
          key: 'B', label: '表象 · 先描述问题', weight: 22, where: 'any',
          patterns: [/问题(?:是)?|出了|出现|故障|投诉|延期|出错|翻倍|异常/],
          tip: '先把问题现象客观描述清楚，不带情绪归因。'
        },
        {
          key: 'R', label: '根因 · 找到根本原因', weight: 22, where: 'any',
          patterns: [/根(?:本原因|源)|深层|本质|真正的原因|归根结底|流程|机制/],
          tip: '点出根本原因："归根结底是流程漏洞，不是人的失误。"'
        },
        {
          key: 'A', label: '对策 · 防止再犯', weight: 22, where: 'any',
          patterns: [/对策|解决(?:办法|方案)?|防止|避免再|改进|措施|清单|检查项/],
          tip: '给出防再犯的具体对策，落在流程而不是口号。'
        }
      ]
    },

    johari: {
      name: '乔哈里视窗',
      flow: ['公开区', '盲区', '隐藏区', '未知区'],
      intro: '沟通视野模型：用"我知道/你知道"四个分区，主动扩大共识。',
      elements: [
        {
          key: 'O', label: '公开区 · 说共识', weight: 28, where: 'any',
          patterns: [/大家都知道|我们都(?:清楚|明白|知道)|公开|共识|共同(?:知道|了解)|摊开/],
          tip: '先讲双方都知道的信息，建立安全氛围。'
        },
        {
          key: 'B', label: '盲区 · 请对方指出', weight: 24, where: 'any',
          patterns: [/盲区|我没(?:注意|意识到|发现)|你看(?:出来)?|帮我指(?:出)?|旁观者|你(?:平时)?觉得我/],
          tip: '主动邀请对方指出你没看到的问题："你觉得我有什么没做好的？"'
        },
        {
          key: 'H', label: '隐藏区 · 自我披露', weight: 24, where: 'any',
          patterns: [/跟你说(?:句)?实话|坦白(?:说|讲)|其实我|没跟(?:你|大家)提过|隐藏|透露|我(?:一直|其实)(?:担心|在意)/],
          tip: '适度披露你的真实顾虑与想法，减少信息差。'
        },
        {
          key: 'U', label: '未知区 · 共同探索', weight: 24, where: 'any',
          patterns: [/一起(?:探讨|试试|找|试)|我们都不知道|未(?:知|来)的(?:可能|空间)|探索|共同|慢慢(?:磨合|试)/],
          tip: '把不确定的部分变成共同探索："这块我们一起慢慢试。"'
        }
      ]
    },

    elevator: {
      name: '电梯演讲',
      flow: ['一句话结论', '三点支撑', '行动呼吁'],
      intro: '30 秒说清一件事：结论先行，三点支撑，落到明确的行动请求。',
      elements: [
        {
          key: 'C', label: '结论 · 一句话说清', weight: 34, where: 'head',
          patterns: [/我的(?:观点|提议|建议|项目|请求)|一句话|核心(?:就)?是|今天想(?:请|要)|请求|想请您|想请大家/],
          tip: '第一句就是结论加诉求："我的提议是……"，30 秒里没有铺垫的位置。'
        },
        {
          key: 'S', label: '支撑 · 三个理由', weight: 33, where: 'any',
          patterns: [/第一|第二|第三|三个?(?:点|理由|方面|原因)|首先|其次|最后/],
          tip: '用三点支撑结论，多一个都是负担；每点一句带过。'
        },
        {
          key: 'A', label: '呼吁 · 落到行动', weight: 33, where: 'tail',
          patterns: [/希望|请求|请(?:您|大家|你)|考虑|批准|拍板|合作|给(?:个)?(?:机会|答复)|下午|今天|明天/],
          tip: '结尾明确你要对方做什么决定："只要您点头，我今天就排好分工。"'
        }
      ]
    }
  };

  const FW_KEYS = Object.keys(FRAMEWORKS);

  /* ================= 框架分析 ================= */
  function analyzeFramework(fwKey, text) {
    const fw = FRAMEWORKS[fwKey];
    const clauses = splitClauses(text);
    const len = (text || '').replace(/\s/g, '').length;
    const elements = [];
    let gotWeight = 0, totalWeight = 0;

    fw.elements.forEach(el => {
      totalWeight += el.weight;
      let matched = false, evidences = [], note = '';
      if (el.custom) {
        const r = el.custom(text);
        matched = r.matched;
        note = r.note || '';
      } else {
        const scope = el.where === 'head' ? clauses.slice(0, 2)
          : el.where === 'tail' ? clauses.slice(-3) : clauses;
        scope.forEach(cl => {
          el.patterns.forEach(re => {
            if (re.test(cl) && evidences.length < 2 && evidences.indexOf(cl) < 0) evidences.push(cl);
          });
        });
        matched = evidences.length > 0;
      }
      if (matched) gotWeight += el.weight;
      elements.push({ key: el.key, label: el.label, matched, evidences, tip: el.tip, note });
    });

    // 结构分 70 + 内容量 15 + 流畅度 15
    const structScore = totalWeight ? (gotWeight / totalWeight) * 100 : 0;
    const lenScore = Math.min(1, len / 160) * 100;
    const fillers = countFillers(text);
    const fillerRate = clauses.length ? fillers.reduce((s, f) => s + f.c, 0) / clauses.length : 0;
    const fluencyScore = Math.max(0, 100 - fillerRate * 260);

    let score = Math.round(structScore * 0.7 + lenScore * 0.15 + fluencyScore * 0.15);
    if (len < 40) score = Math.min(score, 35);

    const strengths = [], weaknesses = [];
    elements.forEach(el => {
      if (el.matched && el.evidences && el.evidences.length) {
        strengths.push({ title: el.label + ' ✔', text: '你的表达中有："' + el.evidences[0].slice(0, 42) + (el.evidences[0].length > 42 ? '…' : '') + '"' });
      } else if (el.matched) {
        strengths.push({ title: el.label + ' ✔', text: el.note });
      } else {
        weaknesses.push({ title: el.label + ' ✘', text: el.tip });
      }
    });
    if (len >= 120 && len <= 500) strengths.push({ title: '篇幅适中 ✔', text: '共 ' + len + ' 字，接近一次 1 分钟左右的表达量。' });
    if (len < 80) weaknesses.push({ title: '内容偏少', text: '目前只有 ' + len + ' 字。建议展开到 150 字以上（约 1 分钟），让每个环节都有支撑。' });
    if (fillers.length) {
      const top = fillers.slice(0, 2).map(f => '"' + f.w + '"×' + f.c).join('、');
      weaknesses.push({ title: '口头禅偏多', text: '检测到 ' + top + '。表达时可用停顿代替口头禅，效果会干净很多。' });
    } else if (clauses.length >= 3) {
      strengths.push({ title: '表达干净 ✔', text: '没有检测到高频口头禅，语流清爽。' });
    }

    // SCQA 顺序检查
    let orderNote = null;
    if (fw.orderCheck) {
      const order = { S: -1, C: -1, Q: -1, A: -1 };
      ['S', 'C', 'Q', 'A'].forEach(k => {
        const el = fw.elements.find(e => e.key === k);
        el.patterns.forEach(re => {
          const idx = text.search(re);
          if (idx >= 0 && order[k] < 0) order[k] = idx;
        });
      });
      const found = ['S', 'C', 'Q', 'A'].filter(k => order[k] >= 0);
      if (found.length >= 3) {
        let asc = true;
        for (let i = 1; i < found.length; i++) if (order[found[i]] < order[found[i - 1]]) asc = false;
        if (asc) { orderNote = 'S→C→Q→A 顺序正确，故事线清晰。'; strengths.push({ title: '结构顺序正确 ✔', text: orderNote }); }
        else { orderNote = '注意：SCQA 的顺序建议为 情境→冲突→问题→答案，你的部分环节顺序颠倒，故事张力会打折扣。'; weaknesses.push({ title: '顺序可以更顺', text: orderNote }); }
      }
    }

    return { score, level: levelOf(score), elements, strengths, weaknesses, len, clauses: clauses.length };
  }

  /* ================= 参考答案生成 ================= */
  function buildReference(fwKey, topic) {
    const p = topic.points, bg = topic.bg, ex = topic.example, cl = topic.closing;
    switch (fwKey) {
      case 'prep':
        return '【P 观点】关于「' + topic.title + '」，我的看法是：' + p[0] + '。\n【R 理由】原因有两点：第一，' + p[1] + '；第二，' + p[2] + '。\n【E 举例】' + ex + '\n【P 重申】所以说，' + cl;
      case 'pyramid':
        return '【结论先行】「' + topic.title + '」，我的核心结论是：' + p[0] + '。\n【论据一】首先，' + p[1] + '。\n【论据二】其次，' + p[2] + '。\n【例证支撑】' + ex + '\n【总结回扣】总之，回到最初的结论——' + cl;
      case 'scqa':
        return '【S 情境】' + bg + '\n【C 冲突】但现实是，大多数人要么完全忽视这件事，要么想做却用错了方向，结果常常事倍功半。\n【Q 问题】那么，到底应该怎么做，才能真正把这件事做好？\n【A 答案】我的答案是三步：首先，' + p[0] + '；其次，' + p[1] + '；最后，' + p[2] + '。' + ex + '\n记住一句话：' + cl;
      case 'compare':
        return '【常见做法】面对「' + topic.title + '」，很多人的做法是随大流、凭感觉，效果如何全看运气。\n【更好的做法】而更好的方式是：' + p[0] + '，同时' + p[1] + '。\n【对比收束】两相对比，高下立判——' + ex + '\n【结论】所以，' + cl;
      case 'fire':
        return '【F 事实】先说事实：' + bg + ' 比如：' + ex + '\n【I 解读】在我看来，这说明：' + p[0] + '。\n【R 反应】这让我既有些着急，也感到期待——着急的是很多人还没意识到，期待的是改变并不难：' + p[1] + '。\n【E 期望】因此，我希望接下来：' + p[2] + '。一句话：' + cl;
      case 'ride':
        return '【R 风险】如果继续忽视「' + topic.title + '」，代价可能是：走弯路、耗时间、错过窗口期。\n【I 利益】而认真做对了，收益非常直接：' + p[0] + '，还能' + p[1] + '。\n【D 差异】与常见做法不同的是：' + p[2] + '——这正是它值得投入的原因。\n【E 影响】当然，它也不是万能的：' + ex + '\n所以我的建议是：' + cl;
      case 'star':
        return '【S 情境】' + bg + '\n【T 任务】' + p[0] + '\n【A 行动】' + p[1] + '；' + p[2] + '\n【R 结果】' + ex + '\n回顾这件事：' + cl;
      case 'golden':
        return '【Why 为什么】' + p[0] + '\n【How 怎么做】' + p[1] + '\n【What 做什么】' + p[2] + '\n' + ex + '\n一句话：' + cl;
      case 'grow':
        return '【G 目标】' + p[0] + '\n【R 现状】' + p[1] + '\n【O 方案】' + p[2] + (p[3] ? '；' + p[3] : '') + '\n【W 行动】' + ex + '\n记住：' + cl;
      case 'wwhw':
        return '【Who 谁】' + p[0] + '\n【What 什么事】' + p[1] + '\n【How 怎么办】' + p[2] + '\n【Why 为什么】' + ex + '\n所以说：' + cl;
      case 'funnel':
        return '【现象 衰减】心里想的是百分之百，说出口剩八成，对方听到六成、理解四成，真正执行可能只剩两成。\n【原因 丢失】' + p[0] + '\n【对策 确认】' + p[1] + '\n【呼吁 复述】' + p[2] + '\n记住：' + cl;
      case 'scrtv':
        return '【S 情境】' + bg + '\n【C 冲突】' + p[0] + '\n【R 解决】' + p[1] + '\n【T 转机】' + p[2] + '\n【V 愿景】' + ex + ' 相信接下来：' + cl;
      case 'pdca':
        return '【P 计划】' + p[0] + '\n【D 执行】' + p[1] + '\n【C 检查】' + p[2] + '\n【A 改进】' + (p[3] || ex) + '\n循环起来：' + cl;
      case 'fivew':
        return '【Who 谁】' + p[0] + '\n【When·Where 何时何地】' + bg + '\n【What 何事】' + p[1] + '\n【Why 为何】' + p[2] + '\n【How 如何】' + ex + '\n' + cl;
      case 'fivew2':
        return '【5W 事实】' + bg + ' 谁来做、什么时候、在哪里、做什么、为什么做，先讲全。\n【How 方法】' + p[0] + '；' + p[1] + '\n【How much 成本】' + p[2] + '\n' + cl;
      case 'fivewhys':
        return '【表象问题】' + bg + '\n【连环追问】为什么会这样？因为' + p[0] + '。再问为什么？因为' + p[1] + '。继续问为什么？因为' + p[2] + '。\n【根因】归根结底：' + p[2] + '\n【对策】' + ex + '\n' + cl;
      case 'johari':
        return '【公开区 共识】' + bg + ' 先把双方都知道的事对齐。\n【盲区 请对方指出】' + p[0] + '\n【隐藏区 自我披露】' + p[1] + '\n【未知区 共同探索】' + p[2] + '\n' + cl;
      case 'elevator':
        return '【一句话结论】' + p[0] + '\n【三点支撑】第一，' + p[1] + '；第二，' + p[2] + '；第三，' + (p[3] || ex) + '\n【行动呼吁】' + cl;
      default:
        return '';
    }
  }

  /* ================= 复述分析 ================= */
  const CLOSING_MARKS = [/总之|综上|所以说|这说明|这就是|告诉我们/, /可以看到|意味着/];

  function analyzeRetell(article, text, peeks) {
    const clauses = splitClauses(text);
    const len = (text || '').replace(/\s/g, '').length;

    // 要点覆盖
    const points = article.points.map(pt => {
      const hits = pt.keywords.filter(k => text.indexOf(k) >= 0);
      return { label: pt.label, keywords: pt.keywords, hits, hit: hits.length > 0 };
    });
    const hitCount = points.filter(p => p.hit).length;
    const coverage = points.length ? hitCount / points.length : 0;

    // 开头点题
    const headText = clauses.slice(0, 2).join('') || '';
    const openingOk = article.titleKeys.some(k => headText.indexOf(k) >= 0);

    // 结尾收束
    const tailText = clauses.slice(-2).join('') || '';
    const closingOk = CLOSING_MARKS.some(re => re.test(tailText)) ||
      article.points.some(pt => pt.keywords.some(k => tailText.indexOf(k) >= 0));

    // 顺序检测：每个命中要点首个关键词出现的位置
    const positions = [];
    article.points.forEach((pt, i) => {
      let first = -1;
      pt.keywords.forEach(k => {
        const idx = text.indexOf(k);
        if (idx >= 0 && (first < 0 || idx < first)) first = idx;
      });
      if (first >= 0) positions.push({ index: i, pos: first });
    });
    let inversions = 0;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i].index < positions[i - 1].index) inversions++;
    }
    const orderOk = positions.length >= 2 ? inversions === 0 : true;

    // 篇幅
    const ratio = article.text.replace(/\s/g, '').length ? len / article.text.replace(/\s/g, '').length : 0;
    let lenScore = 0, lenNote = '';
    if (ratio >= 0.25 && ratio <= 0.9) { lenScore = 12; lenNote = '篇幅适中（原文的 ' + Math.round(ratio * 100) + '%）。'; }
    else if (ratio < 0.15) { lenScore = 3; lenNote = '复述只有原文的 ' + Math.round(ratio * 100) + '%，内容展开不足。'; }
    else if (ratio > 1.5) { lenScore = 6; lenNote = '复述比原文还长 ' + Math.round(ratio * 100) + '%，可能加入过多细节或照读，建议提炼着说。'; }
    else { lenScore = 8; lenNote = '篇幅基本可以（原文的 ' + Math.round(ratio * 100) + '%）。'; }

    let score = Math.round(coverage * 60 + (openingOk ? 10 : 0) + (closingOk ? 10 : 0) + (orderOk ? 8 : 3) + lenScore);
    if (peeks) score = Math.max(0, score - peeks * 3);

    const strengths = [], weaknesses = [];
    points.forEach(p => {
      if (p.hit) strengths.push({ title: '覆盖要点：' + p.label, text: '你提到了相关关键词，表达自然。' });
      else weaknesses.push({ title: '遗漏要点：' + p.label, text: '复述中最好包含这部分内容，关键词提示：' + p.keywords.slice(0, 3).join(' / ') + '。' });
    });
    if (openingOk) strengths.push({ title: '开头点题 ✔', text: '开头就交代了主题，听者容易跟上。' });
    else weaknesses.push({ title: '开头未点题', text: '建议第一句先说"这篇文章讲的是……"，让听者立刻知道主题。' });
    if (closingOk) strengths.push({ title: '结尾有收束 ✔', text: '结尾有总结或回到主题，结构完整。' });
    else weaknesses.push({ title: '结尾缺少收束', text: '最后一句可以加一句"所以说…… / 这告诉我们……"来收尾。' });
    if (!orderOk) weaknesses.push({ title: '要点顺序跳跃', text: '部分要点的讲述顺序与原文不一致，按原文顺序讲会更清晰。' });
    if (lenNote.indexOf('不足') >= 0 || lenNote.indexOf('照读') >= 0) weaknesses.push({ title: '篇幅问题', text: lenNote });
    if (peeks) weaknesses.push({ title: '偷看原文 ' + peeks + ' 次', text: '复述练习尽量凭理解和记忆输出，偷看会降低训练效果。' });

    return { score, level: levelOf(score), coverage: Math.round(coverage * 100), points, openingOk, closingOk, orderOk, ratio, len, strengths, weaknesses };
  }

  /* ================= 说服力分析 ================= */
  const PERSUADE_DIMS = [
    {
      key: 'empathy', label: '共情倾听', weight: 15,
      patterns: [/我(?:理解|明白|懂|知道)您的/, /换位|站在您的角度|您的(?:顾虑|担心|心情|压力)/, /确实|的确|换成我/, /难为您|让您为难/, /您(?:说得对|担心的是)|明白您的意思|能理解|理解您/],
      tip: '先接住对方的情绪："我理解您担心的是……"，共情是说服的第一块敲门砖。'
    },
    {
      key: 'benefit', label: '利益驱动', weight: 20,
      patterns: [/对您|为您|帮您|给您/, /好处|收益|价值|利益|划算/, /省[下时钱]|节省|提升|更(?:方便|安心|省心|划算)/, /对(?:您|你)来(?:说|讲)|您(?:可以|能|会)|帮你?|你也能/],
      tip: '把话说到对方的利益上："这对您来说意味着……"，而不是只说自己的诉求。'
    },
    {
      key: 'evidence', label: '事实依据', weight: 20,
      patterns: [/数据|据统计|数字是|报告|测试/, /举个例子|比如|上次|去年|上个月|上一?任/, /我们(?:团队|公司|项目)的/, /实际上|事实上|根据|有记录/],
      tip: '用事实和例子支撑观点："上个月的数据是……"，比形容词有力得多。'
    },
    {
      key: 'concession', label: '让步与折中', weight: 15,
      patterns: [/可以(?:先|理解)|要不|或者这样|折中|各退一步/, /如果您不方便|两个方案|换个方式/, /也可以|不强求/, /退一步|如果说|可以先|各让|让一步/],
      tip: '给对方台阶与选择："要不这样，我们各退一步……"，灵活性让对方更愿意点头。'
    },
    {
      key: 'action', label: '明确行动', weight: 15,
      patterns: [/不妨|建议|我们可以先|要不咱们/, /今天|明天|这周|下?周一|马上|立刻/, /定个|签|试一周|先试/, /我们先?|从(?:今天|现在)开始|约定|落实到/],
      tip: '落到具体下一步："要不我们先试一周？"——没有行动建议的说服是半场球。'
    },
    {
      key: 'respect', label: '尊重与礼貌', weight: 15,
      patterns: [/您|请|谢谢|感谢|麻烦您/, /占用您|耽误您/, /劳驾|辛苦了?|抱歉|不好意思|打扰/],
      tip: '多用"您 / 请 / 谢谢"，尊重感决定对方是否愿意继续听。'
    }
  ];

  function analyzePersuasionTurn(text) {
    return PERSUADE_DIMS.map(d => ({
      key: d.key, label: d.label, count: countMatches(text, d.patterns), weight: d.weight
    }));
  }

  function analyzePersuasionOverall(turnTexts, scenario) {
    const combined = (turnTexts || []).join('\n');
    const dims = PERSUADE_DIMS.map(d => {
      const c = countMatches(combined, d.patterns);
      const gain = c >= 2 ? d.weight : c === 1 ? Math.round(d.weight * 0.6) : 0;
      return { key: d.key, label: d.label, count: c, gain, weight: d.weight, tip: d.tip };
    });
    let score = dims.reduce((s, d) => s + d.gain, 0);

    // 场景关切加分（最多 8 分）
    const focusHits = (scenario.focus || []).filter(k => combined.indexOf(k) >= 0);
    if (focusHits.length) score += Math.min(8, focusHits.length * 3);

    const strengths = [], weaknesses = [];
    dims.forEach(d => {
      if (d.gain >= d.weight) strengths.push({ title: d.label + ' ✔', text: '你的表达中多次出现相关表达，运用自然。' });
      else if (d.gain > 0) strengths.push({ title: d.label + ' ✔', text: '有所体现，但可以更充分一些。' });
      else weaknesses.push({ title: d.label + ' ✘', text: d.tip });
    });
    if (focusHits.length >= 2) strengths.push({ title: '切中对方关切 ✔', text: '你提到了对方最在意的事：' + focusHits.slice(0, 4).join('、') + '。' });
    else if ((scenario.focus || []).length) weaknesses.push({ title: '未切中对方核心关切', text: '对方最在意：' + scenario.focus.join('、') + '。把话说到这些点上，说服力会翻倍。' });
    const shortTurns = (turnTexts || []).filter(t => t.replace(/\s/g, '').length < 10).length;
    if (shortTurns) weaknesses.push({ title: '有 ' + shortTurns + ' 轮表达过于简短', text: '每轮至少展开两三句：观点 + 理由 + 方案，对方才有得考虑。' });
    const fillers = countFillers(combined);
    if (fillers.length) weaknesses.push({ title: '口头禅偏多', text: '检测到 ' + fillers.slice(0, 2).map(f => '"' + f.w + '"×' + f.c).join('、') + '，可用停顿代替。' });

    const outcome = score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low';
    const outcomeText = {
      high: '说服成功 🎉 对方接受了你的核心提议',
      mid: '基本成功 🙂 对方态度松动，给出了折中方案',
      low: '暂未成功 💪 对方仍在犹豫，换一套策略再试试'
    }[outcome];

    return { score, dims, strengths, weaknesses, outcome, outcomeText, focusHits };
  }

  return {
    splitClauses, similarity, countFillers, levelOf,
    FRAMEWORKS, FW_KEYS,
    analyzeFramework, buildReference,
    analyzeRetell, analyzePersuasionTurn, analyzePersuasionOverall
  };
})();
