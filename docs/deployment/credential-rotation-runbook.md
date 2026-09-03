# 凭据轮换与 Deploy Key 落地手册

> 关联：`docs/reviews/2026-09-03-cicd-retrospective.md`（D 类根因）、`scripts/deploy-bidmaster.sh`（目标形态的部署脚本）。
> 本文只写操作，不重复故障现象。所有真实值一律不落本文、不落仓库。

## 0. 先破除一个误解：轮换不是每次部署的动作

| 动作 | 频率 | 触发条件 |
| --- | --- | --- |
| 日常部署 | 每次合并 main 自动发生 | 不需要碰任何凭据 |
| **轮换**（本文第 1、3 节） | 一次性整改，之后按年 / 按需 | 凭据曾经明文外泄、离职交接、怀疑泄漏 |
| **换机制**（本文第 2 节 Deploy Key） | 一次性，做完就永久不用再管 | 与部署频率无关 |

也就是说：本次要做的是「把已经脏了的凭据作废 + 把明文机制换成不可逆的只读机制」，
做完之后你日常发版什么都不用换。第 2 节做完，第 3 节在部署链路上就不需要了（服务器不再用你的个人 token）。

为什么必须做：泄漏链条是 `个人 token → 能推 main → 流水线自动部署到你的生产机`，
不是「代码被看到」的级别，是「任意代码自动上线」的级别。

---

## 1. 轮换 webhook 共享密钥（零失败窗口做法）

密钥现在存在于两处，**必须同时一致**：服务器 `/opt/webhookd/webhook-server.py` 的校验值、
CNB 密钥仓库 `bidmaster-secrets/deploy.yml` 里 `COOLIFY_DEPLOY_WEBHOOK` 的 URL。
只改一处 → CI 那步 `curl` 拿 401 → CD 当场断。这就是「顺序有坑」的含义。

正解是**让服务器临时同时接受新旧两个值**，把风险窗口压到零：

```bash
# ①【你·服务器】先看现在密钥写在哪、什么形状
grep -n 'token\|TOKEN' /opt/webhookd/webhook-server.py | head
cp -a /opt/webhookd/webhook-server.py /opt/webhookd/webhook-server.py.bak-$(date +%F)

# ②【你·服务器】生成新值
NEW=$(openssl rand -hex 24); echo "$NEW"

# ③【你·服务器】把校验处改成「新旧都收」：把比较从单值改为白名单包含
#    原代码形如：  if got != TOKEN:
#    改为：        if got not in TOKENS:
#    并在上方定义： TOKENS = {"旧值", "新值"}
#    （把 ① 的输出发我，我直接给你可粘贴的 diff —— 这一步我可以代做，前提是先看到源文件）

# ④【你·服务器】生效
systemctl restart webhook-bidmaster

# ⑤【你·CNB 网页】密钥仓库 bidmaster-secrets/deploy.yml 里把 COOLIFY_DEPLOY_WEBHOOK
#    的 token 换成 ② 的新值（此处只能你手动：需要登录 CNB 后台）

# ⑥【你·服务器】验证新值可用、旧值也已失效
curl -sS -o /dev/null -w '新值 → %{http_code}\n' "https://bidmaster.asia/hooks/deploy?token=$NEW"
sed -i 's/"旧值", //' /opt/webhookd/webhook-server.py && systemctl restart webhook-bidmaster
grep -n '旧值' /opt/webhookd/webhook-server.py || echo '旧值已摘除 ✓'
```

④ 与 ⑤ 之间旧 URL 依然可用，所以这段时间内的部署不会失败；⑥ 摘除旧值后必须立刻验一次，
因为这是唯一可能掐断 CD 的动作。

---

## 2. Deploy Key 取代明文个人 token（一次做掉，永久不用再换）

现状：`/opt/webhookd/scripts/deploy-bidmaster.sh` 里 remote 写成
`https://yaojingbo:<个人token>@cnb.cool/...` —— 你**全账号权限**的明文躺在一个可读脚本里。
目标：改成一把「只对这一个仓库有效、只读」的 SSH 密钥。

```bash
# ①【你·服务器】生成专用密钥（不设口令，因为要无人值守）
ssh-keygen -t ed25519 -f /root/.ssh/cnb-deploy -N '' -C "bidmaster-deploy@$(hostname)"
cat /root/.ssh/cnb-deploy.pub          # 复制这一整行输出

# ②【你·CNB 网页】仓库 → 设置 → 部署密钥（Deploy Key）→ 新增
#    标题 bidmaster-server-readonly，粘贴 ① 的公钥，权限选【只读】
#    （若 CNB 该处无只读开关，则只贴公钥即可：Deploy Key 本身不含写权限授权）

# ③【你·服务器】测连通 + 测「只读」是否真只读
ssh -i /root/.ssh/cnb-deploy -o StrictHostKeyChecking=accept-new -T git@cnb.cool
cd /var/www/bid-master-web
git remote set-url origin git@cnb.cool:yaojingbo-2026/bidmaster.git
git fetch origin main && git pull --ff-only origin main        # 读：应成功
git push origin main --dry-run                                  # 写：应被拒（权限不足才算对）
```

③ 最后一行如果**没被拒**，说明这把 key 有写权限，必须回 ② 改成只读——否则整件事没有意义。

```bash
# ④【你·服务器】让 ssh 对该主机固定用这把 key（避免污染其它仓库）
cat >> /root/.ssh/config <<'CFG'
Host cnb.cool
    IdentityFile /root/.ssh/cnb-deploy
    IdentitiesOnly yes
CFG

# ⑤【你·服务器】换上仓库里那份带健康门的脚本（权威版本在 scripts/deploy-bidmaster.sh）
cp -a /opt/webhookd/scripts/deploy-bidmaster.sh /opt/webhookd/scripts/deploy-bidmaster.sh.bak-$(date +%F)
cd /var/www/bid-master-web
install -m 750 scripts/deploy-bidmaster.sh /opt/webhookd/scripts/deploy-bidmaster.sh
grep -n 'token\|://.*:.*@' /opt/webhookd/scripts/deploy-bidmaster.sh || echo '脚本内已无明文凭据 ✓'

# ⑥【你·服务器】清掉旧脚本与 git 配置里残留的 token
git -C /var/www/bid-master-web config --get remote.origin.url    # 确认已无 :token@
```

完成后：**第 3 节对部署链路不再需要**，但那个 token 依然要作废，因为它已经外泄过。

---

## 3. 作废并重建 CNB 个人访问令牌

```text
【你·CNB 网页】头像 → 个人设置 → 访问令牌 → 删除 4KtN… → 新建
                新令牌只勾选 read_repository（部署链路只需要读）
```

换完要同步的存放点（少一处就会静默失败）：

| 位置 | 处理 |
| --- | --- |
| 服务器 `deploy-bidmaster.sh` | 若已完成第 2 节 → 这里根本不该再有 token，按 ⑥ 复核 |
| 本地 `.env` 的 `CNB_GIT_TOKEN` | 换新值（`.env.example` 里已有指向本手册的说明） |
| 本地 git 凭据缓存 | `printf 'protocol=https\nhost=cnb.cool\n\n' \| git credential-osxkeychain erase`（macOS） |
| CNB 流水线本身 | 无需改：流水线用平台内置身份拉代码，只有「从流水线里 push」才需要令牌 |

---

## 4. 收尾核对

- [ ] 用旧 webhook token `curl` 返回被拒
- [ ] 用新 token `curl` 返回 202，且 `/var/log/bidmaster-deploy.log` 出现带 SHA 与「已通过启动健康门」的完成行
- [ ] 服务器 `git pull` 走 SSH 且 `git push --dry-run` 被拒（只读成立）
- [ ] 全机再无明文个人 token：`grep -rn '4KtN' /opt /root /var/www 2>/dev/null` 无输出
- [ ] 下一次正常合并能自动完成部署（证明没把 CD 换断）
