# Marketplace 大类重分类 — 执行日志

- **任务**: 按 `docs/audit/2026-06-22-marketplace大类重分类审计与实施方案.md` 定稿方案,执行 14 条 `category` 值重分类(15→18 大类)。
- **基准**: `main` @ `43390df`
- **任务分支**: `task/marketplace-recategorize-20260622`
- **执行者**: 主控(全程自主,破坏性操作停闸门)

---

## 第一阶段 · 前置审计(严苛评审官视角)

### 审计方法
不采信方案文档自述,直接用 `bun` 解析 `.crabcode-plugin/marketplace.json` 提取全量 `name→category` 现状,与方案文档第 1/3/4 节逐条对账;并读 `src/policy/marketplaceValidator.ts` 核验「category 无白名单」根因。

### 逐条结构性审计

**问题①:`category` 是无枚举约束的自由字符串**
- 问题描述:任意字符串都能通过校验,历史上「媒体」被塞进 `content-office`、「记忆」被塞进 `essentials`、4 个外部连接器混进 `dev-tools`。
- 根因(非症状):`marketplaceValidator.ts:32` 仅把 `category` 列入 `REQUIRED_ENTRY_FIELDS`(必填非空),**全文件无任何 category 合法值/枚举校验**(已读 1-266 行确认)。分类正确与否完全依赖人工自觉。
- 影响面与关联方:仅 `marketplace.json` 自身 + 把 category 当必填项的校验器;**不触** `AutomationCategory`(`src/types.ts`)与推荐引擎(那是另一套无关概念,根因①已隔离)。
- 是否症状级修复:本次「改 category 值」是对**当前分类错误**的根治(媒体/记忆/连接器各归其类),但**不根治「未来再混」**——若不加白名单,新增条目仍可乱填,会在「下一次有人新增/改 entry 时」以同样形式复发。该预防层 = 方案第 5 节配套,文档已明确分离为独立立项(见下「偏离判断」)。
- 同类变体:全仓仅此一处 category 概念;`AutomationCategory` 是闭合 union 类型(`mcp/skill/hook/...`),本就有类型约束,无同类缺口。

**问题②:中文名无落档载体**
- 根因:仓库无 `category→中文名` 映射表,kebab id 是唯一稳定语义载体。
- 影响:故「工作平台→企业工作台」只能落在 id 上(`work-platform`→`enterprise-workbench`),方案决策记录已据此定案。
- 是否症状级:改 id 承载语义是正解;若要中文名正式落档需建 `categories.json`(第 5 节配套,独立项)。

### 现状对账结果(73 条 / 15 大类)
方案文档第 1/3/4 节对现状的全部假设 **零偏差**,逐条实测吻合:
- 14 条变更的每个「旧值」均与实测一致:`crabcode-media-ops`@content-office、`crabcode-memory-management`@essentials、5×`crabwork-*`@work-platform、2 示例@essentials、`hookify`@security、4 连接器(context7/greptile/laravel-boost/serena)@dev-tools。
- 现状 15 大类计数 12/11/9/8/5/5/4/4/3/3/3/2/2/1/1 = 73 ✓。
- 最终形态 18 大类核平 12+11+8+6+6+5+4+4+3+2+2+2+2+2+1+1+1+1 = 73 ✓。

### 结论三问
1. **是否存在架构偏差?** 否。改 category 取值是纯数据改动,不触代码/校验/测试/推荐引擎(根因②实测证实校验器无白名单)。
2. **是否过度工程?** 方案本体(14 条数据改动)无过度工程。第 5 节配套(categories.json+白名单+单测)属新增抽象,文档已正确将其标注为「可跳过、需独立评审、后续单独立项」,**本次不执行**(见偏离判断)。
3. **是否遗漏同类问题/低估关联方?** 举一反三已覆盖(媒体/记忆=用户点名;2 示例/hookify/4 连接器=同型大杂烩)。关联方仅 marketplace.json 自身;下游导航映射属跨端契约,记入第 7 节 handoff 提醒。无遗漏。

---

## 偏离判断(第三阶段)

### 偏离点 1:不执行方案第 5 节配套(categories.json + 白名单校验 + 单测)
- **原因**:① 文档自身定位其为「推荐/可跳过/需独立评审/后续单独立项」;② 它改校验器行为(新增 error 分支)= **架构边界变更**,按第三阶段红线「默认保守」;③ 用户原始需求一~四只要求「重分类」,未授权校验加固。
- **影响面**:留下「未来新增 entry 可乱填 category」的预防缺口(根因①的预防层未补)。
- **与原始需求一致性论证**:用户需求是「把分类搞清晰、媒体独立、记忆独立、工作台改名」——指向**当前分类的纠正**,数据改动已 100% 满足。白名单是「防止未来再错」的正交加固,非本次诉求。保守不做,符合「绝不静默扩大范围」。
- **复发点登记**:若不补白名单,缺口将在「后续任何人新增/编辑 marketplace entry 时填入非 18 大类之一的 category」处,以「乱填仍通过三校验」形式复发。记为**已知缺口**,交回用户决定是否独立立项。

### 偏离点 2:第三档存疑项(bio-research 单列 / plugin-management 与 builder-hub 合并)默认不动
- 文档明确「默认不执行,除非用户另行指示」,无额外指示 → 保持原位,不扩大范围。

**走向**:无架构偏差,按原计划串行实施 14 条数据变更。

---

## 第二/三阶段 · 实施

### 根因优先论证(开工前自检)
- **本次改动为何是根因修复而非症状补丁?** 用户诉求的「根因」是分类语义混乱(媒体≠办公却同类、记忆未独立、连接器与造扩展工具混为一谈)。把这些条目按真实类型各归其位,正是对「分类混乱」这一根因的直接消除——不是绕过现象。
- **反证**:若这不是根因,则「媒体/记忆/连接器仍与异类同框」会在导航展示时继续表现为大杂烩。改后三者各自独立成类(media-ops/memory/code-tools)或归入正确类(hookify→dev-tools、2 示例→showcase),现象不再出现。
- 注:`category` 无白名单这一**预防层根因**不在本次范围(见第一阶段「偏离点 1」),作为已知缺口登记。

### 执行手法
用基于 `name` 定位的单 token 替换脚本(`/tmp/recat.mjs`,临时脚本不提交):对每条先正则定位 `"name"` 行,向下取首个 `"category"` 行,**断言旧值匹配**后只替换该 token,保证「只改 category、其余字段一字不动、格式零漂移」。脚本输出 `APPLIED 14/14`,全部命中。

---

## 第四阶段 · 验证(可检验动作,真实输出)

### ① git diff 重读
```
 .crabcode-plugin/marketplace.json | 28 ++++++++++++++--------------
 1 file changed, 14 insertions(+), 14 deletions(-)
```
diff 仅含 14 行删 / 14 行增,**全部为 `"category":` 行**,无任何其他字段改动、无格式漂移、无残留调试代码。逐行核对 14 条变更与方案第 3 节清单一一对应。

### ② 三校验真实输出(主控亲跑)
```
lint:marketplace -> exit=0
lint:manifest    -> exit=0
lint:layout      -> exit=0
```
全部 exit 0,符合根因②预期(category 无白名单约束,纯数据改动不破校验)。

### ③ 改后形态对照(主控亲跑 bun 解析)
18 大类 / 73 条,与方案第 4 节最终形态**逐类逐成员完全吻合**:
- 新增 3 类:`media-ops`(1) / `memory`(1) / `code-tools`(4)
- 改名:`work-platform`→`enterprise-workbench`(5)
- showcase 6(+2 示例)、dev-tools 6(-4 连接器 +hookify)、essentials 2(-记忆 -2 示例)、security 2(-hookify)、content-office 2(-媒体)
- 核平:12+11+8+6+6+5+4+4+3+2+2+2+2+2+1+1+1+1 = 73 ✓

### 需求逐条对照
| 原始需求 | 状态 | 说明 |
|---|---|---|
| 媒体必须独立 | ✅满足 | `crabcode-media-ops` → 独立 `media-ops` |
| 内容与办公可在一起 | ✅满足 | `content-office` 保留 frontend-design + office-suite |
| 工作平台改企业工作台 | ✅满足 | `work-platform`→`enterprise-workbench`(5 条) |
| 记忆管理独立 | ✅满足 | `crabcode-memory-management` → 独立 `memory` |
| 举一反三(全仓同类) | ✅满足 | 2 示例→showcase、hookify→dev-tools、4 连接器→code-tools |
| frontend-design 留 content-office | ✅满足 | 未动 |
| 不过度集中/单一清晰类型 | ✅满足 | 18 类各为单一类型,无新增大杂烩 |
| 第三档存疑项 | ⏸未动(按方案默认) | 无额外指示,保持原位 |
| 第 5 节配套(白名单) | ⏸未做(独立项) | 已登记为已知缺口+复发点 |

---

## 交付后毁灭性复核(敌意视角,终点闸门前)

### 1. 根因证伪
- 本次每条变更均为「把错类条目移到正确类」,直接消除「分类语义混乱」根因。反证:若非根因,媒体/记忆/连接器会在导航继续与异类同框——改后已各自独立/归位,现象消失。
- **唯一已知缺口**:`category` 无白名单(预防层根因)未补。复发点:后续新增/编辑 entry 填入非 18 类之一的值仍通过三校验。**有意识范围控制**(方案第 5 节独立项 + 第三阶段红线保守),非遗漏,交用户决定是否独立立项。
- 同类变体:全仓仅一处 category 概念,无别处残留同型问题(`AutomationCategory` 是闭合 union,本有类型约束)。

### 2. 关联方与回归(最硬一条)
- 全仓 grep `work-platform|content-office|enterprise-workbench|code-tools|media-ops|"category"`(src/scripts/tests,排除 marketplace.json):**唯二命中均为把 `category` 当字段名**(`marketplaceValidator.ts:32` 必填字段列表、`marketplace.test.ts:73` 断言含该字段),**无任何代码/测试硬编码依赖具体 category 取值**。
- 结论:改名与移动**零破坏调用方契约**,坐实「纯数据改动」。
- 测试/校验真实输出(复核时复跑):lint:marketplace/manifest/layout 全 exit=0。
- 无测试覆盖 category 取值的部分,手动验证路径=`bun` 解析 marketplace.json 对照第 4 节最终形态(已逐类逐成员核对吻合)。
- `git diff main...HEAD -- marketplace.json` 过滤后:除 `"category"` 行外**无任何其他增删**,无误伤、无残留调试代码(临时脚本在 `/tmp` 未入仓)。

### 3. 需求对齐
逐条对照见上「需求逐条对照」表:用户点名 4 项 + 举一反三 + frontend-design 边界 = 全满足;第三档/第 5 节按方案默认未动并登记。**无悄悄扩缩范围**。

### 4. 过度工程反审
未引入文档未要求的抽象(categories.json/白名单/新依赖一律未加 = 保守不过度)。新增的执行日志与 category 交接文档分别为任务硬要求(写入日志)与方案第 7 节(跨端契约提醒),非多余产出。

### 5. 交付完整性
- HEAD `git show --name-only`:5 文件齐全(marketplace.json + 执行日志 + 方案文档 + 2 handoff)。
- `git status`:clean,无 stash/worktree 残留。

### 复核结论:**通过**(附 1 项已知缺口:category 白名单未补,复发点已登记,留独立立项)。

---

## 终点闸门 · 合并安全核验(停此交回用户)

- **基线**:任务分支 `task/marketplace-recategorize-20260622` 基于 `main @ 43390df`;`main` 自起始即 `up to date with origin/main`,期间未前进 → **无未合并他人改动、无冲突**。
- **无覆盖风险**:本次仅改 marketplace.json 14 行 + 新增文档,**无删除/回滚/force**,不触他人/他窗口产出。前序 `docs/handoff/2026-06-21-下游字段契约.md` 原为未跟踪文件,本次为「新增入库」非覆盖。
- **未推送**:破坏性/对外操作(合并 main、删分支、push)**默认不执行**,停在此闸门。

### 建议合并步骤(待用户确认后执行)
```
git checkout main
git merge --ff-only task/marketplace-recategorize-20260622   # 应可 ff,main 未前进
# 推送(用户确认后):git push origin main
# 清理(可选):git branch -d task/marketplace-recategorize-20260622
```

---

## 追加工程 · category 白名单加固(用户 2026-06-22 明确授权执行第 5 节配套)

### 授权与偏离解除
此前在「偏离点 1」我按红线保守**未做**白名单(架构边界变更)。用户随后明确指示「执行这个」→ 授权解除保守约束,实施方案第 5 节配套。

### 根因优先论证(真根因,非症状)
- **根因**:`category` 是无枚举约束的自由字符串(`marketplaceValidator.ts` 原仅必填)。本次新增 `categories.json` 权威表 + 校验器白名单,使「非 18 类之一的 category」**直接报 error**。
- **反证(已实测验证)**:故意把某条 category 改成 `bogus-xyz`,`lint:marketplace` 立即报 `category "bogus-xyz" is not declared in .crabcode-plugin/categories.json` 且 exit=1。证明这是根治——非法值在校验阶段被拦,不再依赖人工自觉。
- **残留复发点(登记)**:白名单采用「categories.json 存在才强制、缺失则向后兼容跳过」语义(为不破坏既有以临时 root 运行、不提供分类表的单测契约)。故唯一绕过路径 = **删除 `.crabcode-plugin/categories.json`**;此为显眼破坏行为,且真实仓库该文件已入库。未对「文件缺失」升级为 error,因会破坏既有测试且属过度。如需彻底封堵,可后续在 layout 校验中加「categories.json 必须存在」断言(本次未做,避免范围蔓延)。

### 改动清单
- 新建 `.crabcode-plugin/categories.json`:18 大类 id→displayName(中文)→description 权威表。
- `src/policy/marketplaceValidator.ts`:新增 `loadCategoryWhitelist()`(读表→Set,ENOENT 跳过、解析失败/非数组/缺 id/重复 id 各报 error);主循环对每个 entry 增「category ∉ 白名单 → error」。
- `tests/validators/marketplace.test.ts`:+`writeCategories` helper + 4 用例(命中通过 / 未声明报错 / 缺表跳过的向后兼容契约 / 表内重复 id 报错)。

### 验证(真实输出,主控亲跑)
- `bun test tests/validators/marketplace.test.ts` → **11 pass / 0 fail**(原 7 + 新 4)。
- `bun run lint:marketplace|manifest|layout` → 全 **exit=0**(真实 18 类全部命中白名单)。
- 反向:`category="bogus-xyz"` → 报错 + exit=1;`git checkout` 还原后 exit=0。
- `bun run typecheck` → 因 `node_modules` 未安装(仓库未 `bun install`,预存状态,`git stash` 对比确认改动前后**同一** `bun-types` 缺失错)而无法运行严格类型检查;以 `bun test` + lint 脚本(bun 直接编译运行 TS,无语法/类型阻断)作等价证据。**未擅自 `bun install` 改环境**(越界)。

### 白名单加固 · 关联方回归复核
- `validateMarketplace` 调用方:`scripts/validate-marketplace.ts`、`scripts/validate-all.ts`、单测。`categories.json` 仅 `marketplaceValidator` 读取,无其他消费者。
- `validate-all`(聚合校验)改动前(43390df)vs 改动后 HEAD:**输出逐字节一致,两侧均 exit=1**。该 exit=1 为**预存**的品牌词中性化扫描命中(去品牌化 README/.mcp.json/yaml 中的 anthropic/claude/opus 子串),命中文件本次**一个都未改动** → 我的白名单加固对 validate-all **零回归**。
