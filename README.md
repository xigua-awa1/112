# 港区 · 小游戏 — Cloudflare Pages + D1 全球排行榜部署说明

这个包里是一套可以直接传到 GitHub、再由 Cloudflare Pages 自动构建发布的版本：

```
cloudflare-deploy/
├─ public/
│  └─ index.html                 # 完整游戏（单文件，样式/脚本/模型全部内联）
├─ functions/
│  └─ api/
│     ├─ leaderboard.js          # GET /api/leaderboard  读取全球榜单
│     └─ score.js                # POST /api/score       上传一局成绩并返回排名
├─ schema.sql                    # D1 建表语句
└─ README.md
```

工作方式：

- 游戏仍然是**一个 HTML 文件**，挂在 Cloudflare Pages 的静态站点上；
- `/functions` 里的两个接口由 Cloudflare Pages Functions 自动部署成 `/api/leaderboard` 和 `/api/score`；
- 成绩存在 **Cloudflare D1**（Cloudflare 的 SQLite 数据库）里，所以所有访问者看到的是同一份全球榜单；
- 如果接口没配置好或断网，游戏会自动退回本机排行榜，不影响单机玩。

---

## 一、传到 GitHub

1. 在 GitHub 新建一个仓库，例如 `harbor-mini-game`，可见性选 Public（私有仓库也能接 Pages，但部分账号需要付费计划）。
2. 把这个 `cloudflare-deploy` 文件夹里的内容传到仓库根目录，最终仓库应该是：

```
harbor-mini-game/
├─ public/index.html
├─ functions/api/leaderboard.js
├─ functions/api/score.js
├─ schema.sql
└─ README.md
```

上传方式二选一：

- **网页上传**：仓库页面 → Add file → Upload files，把整个文件夹拖进去，Commit changes。
- **命令行**：

```bash
git init
git add .
git commit -m "init: harbor mini game"
git branch -M main
git remote add origin https://github.com/<你的用户名>/harbor-mini-game.git
git push -u origin main
```

---

## 二、在 Cloudflare 创建 Pages 项目

1. 登录 <https://dash.cloudflare.com/>，左侧选 **Workers & Pages**。
2. 点 **Create** → **Pages** → **Connect to Git**。
3. 授权 GitHub，选中刚才的仓库。
4. 构建设置：
   - Framework preset：**None**
   - Build command：**留空**
   - Build output directory：**`public`**
5. 点 **Save and Deploy**。等状态变成 Success，会得到一个 `https://<项目名>.pages.dev` 的网址。

这时候游戏已经能打开、能玩，但排行榜接口还没有数据库，点排行榜可能会显示“连接失败，以下为本机记录”。下一步补上 D1。

---

## 三、创建 D1 数据库

1. Cloudflare 控制台左侧 → **Storage & Databases** → **D1 SQL Database**。
2. 点 **Create**，数据库名填 `jimao-scores`（名字随意，记住即可），创建。
3. 进入这个数据库 → **Console**（或 Query）。
4. 把 `schema.sql` 的全部内容粘进去，执行。执行成功后会多出 `scores` 表和两个索引。

也可以用命令行（需要本机装 Node.js）：

```bash
npx wrangler login
npx wrangler d1 create jimao-scores
npx wrangler d1 execute jimao-scores --remote --file=./schema.sql
```

---

## 四、把 D1 绑定到 Pages 项目

1. 打开刚才的 Pages 项目 → **Settings** → **Functions** → **D1 database bindings**。
2. 点 **Add binding**：
   - Variable name：**`DB`**（必须正好是 `DB`，接口代码按这个名字取数据库）
   - D1 database：选择 `jimao-scores`
3. 保存。
4. 回到项目 **Deployments**，对最新一次部署点 **Retry deployment**（或重新 push 一次代码），让绑定生效。

> 绑定只在“部署时”注入，所以新增绑定后一定要重新部署一次。

---

## 五、验证

1. 打开 `https://<项目名>.pages.dev`。
2. 标题页输入行动代号，点「排行榜」，标题旁应显示 **全球**，下面出现模式筛选（全部 / 港区主线 / 猎杀名单 / 船坞清剿 / 裂潮无尽）。
3. 玩一局结束（撤离、阵亡、船坞或猎杀结算），会提示“全球排行榜已更新：第 N 名”，结算页的「排行榜排名」显示全球名次。
4. 换一个浏览器或无痕窗口，用另一个名字玩一局，刷新排行榜，应能看到两个人的成绩。
5. 接口自测：
   - 浏览器打开 `https://<项目名>.pages.dev/api/leaderboard?limit=5`，应返回 `{"ok":true,"rows":[...]}`。
   - 如果返回 `D1 未绑定`，说明第四步的变量名不是 `DB`，或没有重新部署。

---

## 六、绑定自己的域名（可选）

Pages 项目 → **Custom domains** → **Set up a domain**，输入你的域名，按提示在 DNS 添加记录。绑定后排行榜接口同域，无需改代码。

---

## 七、本地预览（可选）

装了 Node.js 后，在仓库根目录：

```bash
npx wrangler pages dev public --d1 DB=jimao-scores
```

然后打开终端提示的地址（通常是 `http://localhost:8788`）。用 `file://` 直接双击打开 HTML 时，游戏会禁用在线排行榜、只用本机榜单，这是正常的。

---

## 八、接口与数据

### GET `/api/leaderboard?limit=20&mode=all`

- `limit`：1–50，默认 20
- `mode`：`all` / `campaign` / `hunt` / `dock` / `endless`
- 返回：

```json
{
  "ok": true,
  "rows": [
    { "id": 12, "name": "夜航员", "mode": "dock", "score": 1820, "kills": 31, "accuracy": 0.42, "secs": 512, "created_at": 1794480000000 }
  ]
}
```

### POST `/api/score`

请求：

```json
{ "name": "夜航员", "mode": "dock", "score": 1820, "kills": 31, "accuracy": 0.42, "secs": 512 }
```

返回：

```json
{ "ok": true, "rank": 3, "id": 12 }
```

服务端会校验：名字 1–12 字符、模式白名单、分数 0–300000、击杀 0–3000、命中率 0–1、用时 0–86400。

---

## 九、关于防作弊（需要知道的限制）

这是休闲小游戏，分数由浏览器上报，**懂技术的人可以伪造请求刷榜**。当前服务端只做格式和范围校验，适合朋友之间玩；如果要认真防刷，需要再加：

- 每局开始时向服务端申请一次性 token，结束时校验 token 与时长；
- 服务端根据击杀/命中率/时长做合理性校验；
- Cloudflare Turnstile 人机验证；
- 按 IP 或账号限流。

这些会让部署复杂度明显上升，当前版本没有做。

---

## 十、常见问题

| 现象 | 原因与处理 |
|---|---|
| 排行榜一直显示“连接失败” | 多半是 D1 没绑定，或变量名不是 `DB`；改好后重新部署 |
| `/api/leaderboard` 返回 500 `D1 未绑定` | 同上 |
| 上传成绩提示“已保存在本机” | 接口不可用或网络被拦截；本机榜单仍可用 |
| Pages 构建失败 | 确认 Build output directory 是 `public`，Build command 留空 |
| 修改代码后网页没变 | Pages 每次 push 会自动部署，等 1–2 分钟；也可在 Deployments 手动 Retry |
| 排行榜有重复名字 | 允许同名，按分数排序；同名不算同一个人 |
| 想清空榜单 | D1 控制台执行 `DELETE FROM scores;` |

---

## 十一、更新游戏

以后只要替换 `public/index.html`，commit + push，Cloudflare Pages 会自动重新部署；D1 数据和排行榜不会丢。
