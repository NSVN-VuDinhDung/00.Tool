# AI Coding Agent — Skill & Instruction Reference
### GitHub Copilot · OpenAI Codex CLI · Claude Code

> Tổng hợp từ tài liệu chính hãng (VS Code Docs, GitHub Docs, OpenAI Developers, Claude Code Docs).
> Bản rà soát: 12/08/2026. Các nền tảng thay đổi rất nhanh — luôn kiểm chứng bằng lệnh ở **mục 10** thay vì tin tuyệt đối tài liệu này.

---

## 1. Nguyên lý chung

Cả 3 nền tảng hội tụ về **4 cơ chế** (bản trước chỉ có 3 — thiếu hẳn tầng memory tự động):

| Cơ chế | Copilot | Codex CLI | Claude Code |
|---|---|---|---|
| **Luật nền, luôn bật** | `.github/copilot-instructions.md` · `AGENTS.md` · `CLAUDE.md` | `AGENTS.md` | `CLAUDE.md` |
| **Luật có điều kiện theo file** | `*.instructions.md` (`applyTo`) · `.claude/rules/*.md` (`paths`) | *(không có glob — phân tầng bằng vị trí `AGENTS.md` trên cây thư mục)* | `.claude/rules/*.md` (`paths`) |
| **Quy trình/kỹ năng, nạp theo ngữ cảnh** | `SKILL.md` | `SKILL.md` | `SKILL.md` (có thêm `paths`) |
| **Memory tự động do agent tự ghi** | Memory (VS Code) | Memories / Chronicle | Auto memory (`MEMORY.md`) |

**Bản chất:**

- **Instruction (`copilot-instructions.md` / `AGENTS.md` / `CLAUDE.md`)** = hồ sơ nhân viên mới. Luôn nằm trong context ⇒ phải **ngắn**. Claude Code khuyến nghị dưới 200 dòng/file; dài hơn thì vừa tốn context vừa giảm mức tuân thủ.
- **Skill (`SKILL.md`)** = cẩm nang nghiệp vụ, chỉ đọc vào context khi agent thấy liên quan. Đây là **progressive disclosure**: agent luôn thấy `name` + `description` (rẻ), chỉ đọc toàn bộ nội dung (đắt) khi quyết định dùng.
- **Auto memory** = ghi chú agent tự viết cho chính nó qua các phiên, từ những lần bạn sửa lưng nó. Bạn không viết, nhưng **nên đọc và dọn định kỳ**.

**Điểm quan trọng nhất:**

> Skill **không chỉ chạy thủ công**. Agent quét `description` của mọi skill khả dụng, so khớp câu lệnh bạn gõ, và tự quyết định nạp. Gọi tay (`/skill-name`, `$skill-name`) chỉ là cách ép buộc.
>
> → **`description` là phần quan trọng nhất của SKILL.md.** Viết mơ hồ = skill không bao giờ tự chạy, dù nội dung tốt đến đâu.

**Hệ quả ít người biết — ngân sách mô tả:** danh sách skill bị giới hạn dung lượng, và khi tràn thì **mô tả bị cắt bớt** (chứ không phải skill biến mất), làm mất chính các từ khoá trigger.

| | Ngân sách listing | Giới hạn mỗi skill |
|---|---|---|
| Codex | ≤ 2% context window, hoặc 8.000 ký tự nếu không rõ context window | — |
| Claude Code | mặc định 1% context window (`skillListingBudgetFraction`) | 1.536 ký tự cho `description` + `when_to_use` |
| Copilot | — | `description` tối đa 1024 ký tự |

⇒ **Đặt use case chính ở đầu `description`.** Phần đuôi là phần bị cắt trước.

---

## 2. GitHub Copilot (VS Code / Copilot CLI / cloud agent)

### 2.1 Vị trí lưu

| Loại | Scope | Vị trí |
|---|---|---|
| **Skill** | Project | `.github/skills/` · `.claude/skills/` · `.agents/skills/` |
| **Skill** | Personal | `~/.copilot/skills/` · `~/.claude/skills/` · `~/.agents/skills/` |
| **Instruction luôn bật** | Project | `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md` (+ `.claude/CLAUDE.md`, `CLAUDE.local.md`) |
| **Instruction có điều kiện** | Workspace | `.github/instructions/*.instructions.md` (`applyTo`) · `.claude/rules/*.md` (`paths`) |
| **Instruction có điều kiện** | User | `~/.copilot/instructions/` · `~/.claude/rules/` |
| **Prompt template** | Project/User | `*.prompt.md` |

> ⚠️ **Sửa so với bản cũ:** vị trí user-level `%APPDATA%\Code\User\prompts\` đã lỗi thời. Khi bật **Agent Host**, agent đọc instruction user-level từ `~/.copilot/instructions` và `~/.claude/rules`, **không** đọc từ profile user data của VS Code. Nếu instruction global "im lặng không chạy" trên Windows, gần như chắc chắn là lý do này.

Cấu hình thêm vị trí: `chat.agentSkillsLocations` (skill), `chat.instructionsFilesLocations` (instruction). Monorepo: bật `chat.useCustomizationsInParentRepositories` để lấy customization từ repo cha. Bật/tắt đọc file của agent khác: `chat.useAgentsMdFile`, `chat.useClaudeMdFile`, `chat.useNestedAgentsMdFiles` (thử nghiệm, cho AGENTS.md ở thư mục con).

Cả `.github/instructions/` lẫn `.claude/rules/` đều được **quét đệ quy**, nên có thể gom theo `frontend/`, `backend/`, `testing/`.

### 2.2 Frontmatter

```yaml
# SKILL.md
---
name: my-skill          # BẮT BUỘC. chữ thường/số/gạch ngang, ≤64 ký tự,
                        # PHẢI TRÙNG TÊN THƯ MỤC CHA. Sai → skill im lặng không load.
description: Mô tả rõ skill làm gì VÀ khi nào dùng. ≤1024 ký tự.
argument-hint: "[file] [option]"    # tuỳ chọn
user-invocable: true                # false = ẩn khỏi menu /, agent vẫn tự nạp được
disable-model-invocation: false     # true = chỉ chạy khi gõ tay /skill-name
context: fork                       # thử nghiệm: chạy trong subagent riêng
---
```

```yaml
# *.instructions.md
---
name: 'TypeScript Standards'
description: 'Coding convention cho TS/React'
applyTo: "**/*.ts,**/*.tsx"   # KHÔNG có applyTo → không tự áp dụng
---
```

```yaml
# .claude/rules/*.md  — Copilot dùng `paths`, không phải `applyTo`
---
paths:
  - "src/api/**/*.ts"        # mặc định "**" nếu bỏ trống
---
```

> **Bảng ma trận kích hoạt skill (Copilot):**
>
> | Cấu hình | Gọi bằng `/` | Agent tự nạp |
> |---|---|---|
> | mặc định | ✅ | ✅ |
> | `user-invocable: false` | ❌ | ✅ |
> | `disable-model-invocation: true` | ✅ | ❌ |
> | cả hai | ❌ | ❌ (skill bị vô hiệu) |

### 2.3 Thứ tự ưu tiên — **đã sửa**

Bản cũ ghi chuỗi 5 bậc (`personal > path-scoped > copilot-instructions > AGENTS.md > org`) là **sai**. Tài liệu chính thức chỉ có **3 bậc**:

```
1. Personal instructions (user-level)          ← cao nhất
2. Repository instructions
   (.github/copilot-instructions.md HOẶC AGENTS.md — CÙNG MỘT BẬC)
3. Organization instructions                    ← thấp nhất
```

Và một lưu ý quan trọng: khi có nhiều file instruction, VS Code **gộp tất cả** vào context và **không đảm bảo thứ tự** nào. ⇒ Đừng thiết kế luật dựa trên giả định "file này ghi đè file kia" trong cùng một bậc; hãy loại bỏ mâu thuẫn ngay từ nguồn.

### 2.4 Flow

```
Yêu cầu trong Agent mode
        │
        ▼
① NẠP TỰ ĐỘNG: copilot-instructions.md / AGENTS.md / CLAUDE.md
   + mọi *.instructions.md có applyTo khớp
   + .claude/rules có paths khớp
   (xung đột → theo 3 bậc ở 2.3)
        │
        ▼
② Quét name + description của mọi SKILL.md (project + personal + plugin)
        ├─ Khớp     → nạp toàn bộ SKILL.md
        ├─ Không chắc → gõ /skill-name để ép
        └─ Không khớp → chạy bằng kiến thức nền + instruction ở ①
        │
        ▼
③ Chỉ khi SKILL.md tham chiếu tới file phụ (bằng link Markdown tương đối)
   thì file đó mới được đọc → 3 tầng nạp
```

Tạo nhanh: `/create-skill`, `/create-instruction`, `/init`. Có thể trích skill từ hội thoại đang chạy ("tạo skill từ cách mình vừa debug").

---

## 3. OpenAI Codex CLI

### 3.1 AGENTS.md — instruction luôn bật, phân tầng theo thư mục

Codex build "instruction chain" **một lần khi khởi động phiên**:

1. **Global**: `~/.codex/AGENTS.override.md` nếu có, không thì `~/.codex/AGENTS.md`. Chỉ đọc **1 file** ở tầng này.
2. **Project**: đi từ git root xuống thư mục hiện tại, mỗi thư mục kiểm tra `AGENTS.override.md` → `AGENTS.md` → tên fallback (`project_doc_fallback_filenames`).
3. **Merge**: nối theo thứ tự từ gốc xuống; file càng gần CWD càng ghi đè (vì xuất hiện sau trong prompt).

Giới hạn: `project_doc_max_bytes` (mặc định 32 KiB) — chạm mức này thì dừng nạp thêm.

```
~/.codex/AGENTS.md                        # Global
AGENTS.md                                 # Project root
services/payments/AGENTS.override.md      # Override cho thư mục con
```

> Codex không có glob `applyTo`. Muốn "chỉ áp dụng cho 1 vùng" thì đặt `AGENTS.md` ngay trong thư mục đó — phân tầng bằng **vị trí file**, không phải pattern.

### 3.2 ⚠️ Bẫy tên gọi: "Rules" của Codex ≠ rules của Claude

Codex có trang docs tên **Rules**, nhưng nó **không liên quan gì tới instruction**. Đó là cơ chế kiểm soát *lệnh nào được chạy ngoài sandbox*:

```python
# ~/.codex/rules/default.rules   (cú pháp Starlark)
prefix_rule(
    pattern = ["gh", "pr", "view"],
    decision = "prompt",              # allow | prompt | forbidden
    justification = "Xem PR cần duyệt",
    match = ["gh pr view 7888"],
    not_match = ["gh pr --repo x view 7888"],
)
```

Nhiều rule khớp → Codex lấy quyết định **khắt khe nhất** (`forbidden` > `prompt` > `allow`). Codex tách được lệnh ghép an toàn (`git add . && rm -rf /` bị đánh giá thành 2 lệnh riêng), nhưng gặp redirect/`$(...)`/biến/wildcard thì coi cả chuỗi là **một** lệnh. Test bằng `codex execpolicy check`.

### 3.3 Skills — 6 scope

| Scope | Vị trí | Dùng khi |
|---|---|---|
| `REPO` | `$CWD/.agents/skills` | Skill riêng cho module/service đang đứng |
| `REPO` | `$CWD/../.agents/skills` | Thư mục cha của CWD trong git repo |
| `REPO` | `$REPO_ROOT/.agents/skills` | Skill dùng chung cả repo |
| `USER` | `$HOME/.agents/skills` | Skill cá nhân, mọi repo |
| `ADMIN` | `/etc/codex/skills` | Cấp máy/container |
| `SYSTEM` | Đóng gói sẵn | `skill-creator`, `skill-installer`, `plan`… |

Trùng `name` thì Codex **không gộp**, cả hai cùng xuất hiện trong bộ chọn. Hỗ trợ symlink.

**Quản lý skill:**
- Tạo: `$skill-creator`, hoặc **Record & Replay** (demo workflow → Codex tự soạn skill).
- Cài skill có sẵn: `$skill-installer <tên>`.
- Tắt tạm không xoá — thêm vào `~/.codex/config.toml` rồi khởi động lại:

```toml
[[skills.config]]
path = "/path/to/skill/SKILL.md"
enabled = false
```

### 3.4 Metadata riêng của Codex

```yaml
# <skill>/agents/openai.yaml
interface:
  display_name: "Tên hiển thị"
  short_description: "Mô tả cho UI Codex app"
  icon_small: "./assets/small-logo.svg"
  brand_color: "#3B82F6"
policy:
  allow_implicit_invocation: false   # mặc định true
dependencies:
  tools:
    - type: "mcp"
      value: "openaiDeveloperDocs"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```

---

## 4. Claude Code

### 4.1 CLAUDE.md

| Tầng | Vị trí | Ghi chú |
|---|---|---|
| Managed policy | macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`<br>Linux/WSL `/etc/claude-code/CLAUDE.md`<br>Windows `C:\Program Files\ClaudeCode\CLAUDE.md` | Không thể bị `claudeMdExcludes` loại trừ. Có thể nhúng thẳng nội dung qua key `claudeMd` trong `managed-settings.json` |
| **User** | `~/.claude/CLAUDE.md` | Mọi project |
| **Project** | `./CLAUDE.md` **hoặc** `./.claude/CLAUDE.md` | Commit vào repo |
| **Local** | `./CLAUDE.local.md` | Cá nhân, gitignore. **KHÔNG deprecated** — vẫn là tầng chính thức, nạp cùng CLAUDE.md và xử lý y hệt |
| Directory-scoped | `{repo}/module-x/CLAUDE.md` | Nạp **on-demand** khi Claude đọc file trong thư mục đó |

> ⚠️ **Sửa so với bản cũ:** bản trước ghi `CLAUDE.local.md` là deprecated và khuyên thay bằng `.claude/rules/` — không đúng. Hai thứ này phục vụ mục đích khác nhau: `CLAUDE.local.md` là *cá nhân, không commit*; `.claude/rules/` là *chia nhỏ theo chủ đề, có thể commit*.

**Cách nạp:** đi ngược cây thư mục từ CWD lên, gom tất cả `CLAUDE.md` + `CLAUDE.local.md` gặp được. Các file **được nối vào nhau**, không ghi đè nhau; nội dung xếp từ gốc filesystem xuống CWD, nên file gần CWD nhất được đọc **sau cùng** (⇒ "thắng" theo nghĩa mềm). Trong cùng một thư mục, `CLAUDE.local.md` xếp sau `CLAUDE.md`.

**Import `@path`:**

```markdown
Xem @README để hiểu tổng quan và @package.json để biết các lệnh npm.
- git workflow @docs/git-instructions.md
```

Tối đa 4 hop. **Lưu ý:** file được import vẫn nạp vào context lúc khởi động ⇒ import chỉ giúp *tổ chức*, **không** tiết kiệm context. Muốn tiết kiệm thật thì phải dùng `paths`. Muốn viết đường dẫn mà không import thì bọc backtick.

**Interop với AGENTS.md** — phần quan trọng nhất nếu bạn xài cả 3 agent: Claude Code đọc `CLAUDE.md`, **không** đọc `AGENTS.md`. Cách xử lý:

```markdown
<!-- CLAUDE.md -->
@AGENTS.md

## Claude Code
Dùng plan mode cho thay đổi trong src/billing/.
```

Symlink cũng được (`ln -s AGENTS.md CLAUDE.md`), nhưng trên Windows cần quyền Admin/Developer Mode nên dùng import tiện hơn. Ngoài ra `/init` đọc được `.cursor/rules`, `.copilot-instructions.md`; `/import` mang nguyên cấu hình agent khác sang.

**Vặt nhưng hữu ích:** comment HTML dạng block (`<!-- ghi chú -->`) bị **strip trước khi vào context** — dùng để để lại note cho người, không tốn token.

**Monorepo:** `claudeMdExcludes` (nhận glob, cộng dồn qua các layer settings) để bỏ qua CLAUDE.md của team khác.

### 4.2 `.claude/rules/*.md`

```yaml
---
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{ts,tsx}"       # brace expansion OK
---
- Mọi endpoint phải validate input bằng zod.
- Không log request body chứa password/token.
```

Bổ sung so với bản cũ:

- **User-level rules tồn tại**: `~/.claude/rules/` áp dụng cho mọi project, nạp **trước** project rules (project ưu tiên cao hơn).
- Rule **không có** `paths` → nạp lúc khởi động, cùng độ ưu tiên với `.claude/CLAUDE.md`.
- Rule **có** `paths` → kích hoạt khi Claude **đọc** file khớp pattern, không phải mọi lần gọi tool. ⇒ Luật kiểu *"khi tạo file mới thì phải thêm header X"* thường **không** kích hoạt, vì lúc ghi file Claude chưa từng đọc nó. Loại này nên đưa vào CLAUDE.md hoặc hook.
- **YAML**: glob bắt đầu bằng `*` hoặc `{` **phải bọc nháy kép**, không thì parse lỗi.
- Hỗ trợ symlink → chia sẻ một bộ rule chung cho nhiều project.
- 🐛 Đang có nhiều issue mở về `paths` không nạp đúng (đặc biệt ở user-level, hoặc nạp toàn cục bất chấp `paths`). **Luôn kiểm chứng bằng `/context`** thay vì tin doc.

### 4.3 Skills

| Scope | Vị trí |
|---|---|
| Enterprise | qua managed settings |
| Personal | `~/.claude/skills/{name}/SKILL.md` |
| Project | `.claude/skills/{name}/SKILL.md` |
| Plugin | `<plugin>/skills/{name}/SKILL.md` (namespace `plugin:skill`) |

> ⚠️ **Trùng tên — ngược với trực giác:** thứ tự ghi đè là **enterprise > personal > project**. Tức skill cá nhân của bạn sẽ **nuốt** skill cùng tên mà team commit vào repo. Đây KHÔNG theo quy tắc "càng cụ thể càng thắng" của CLAUDE.md.

Skill ở `.claude/skills/` thư mục con **không** nạp lúc khởi động; chúng xuất hiện lần đầu khi Claude đọc/sửa file trong thư mục đó. Nếu trùng tên với skill gốc repo, biến thể lồng nhau xuất hiện dưới tên có tiền tố thư mục (`/apps/web:deploy`).

**Frontmatter (bảng rút gọn — tất cả đều optional, chỉ `description` là nên có):**

| Field | Ý nghĩa |
|---|---|
| `name` | **Chỉ là nhãn hiển thị.** Tên lệnh lấy từ tên thư mục (khác Copilot!) |
| `description` | Làm gì + khi nào dùng. Bỏ trống → lấy đoạn Markdown đầu tiên |
| `when_to_use` | Trigger phrase bổ sung; cộng dồn vào cap 1.536 ký tự |
| `paths` | **Glob giới hạn khi nào skill được tự kích hoạt** — bản cũ chưa có |
| `disable-model-invocation` | `true` = chỉ gọi tay |
| `user-invocable` | `false` = ẩn khỏi menu `/`, chỉ Claude gọi |
| `allowed-tools` / `disallowed-tools` | Pre-approve / gỡ tool trong lượt gọi skill |
| `context: fork` + `agent` + `background` | Chạy trong subagent riêng |
| `model`, `effort` | Override model / mức effort khi skill active |
| `hooks`, `shell`, `metadata`, `license`, `compatibility`, `argument-hint`, `arguments` | — |

**Tính năng riêng của Claude Code trong phần body:**

```yaml
---
description: Tóm tắt thay đổi chưa commit và cảnh báo rủi ro. Dùng khi hỏi
  "cái gì vừa đổi", muốn viết commit message, hoặc review diff.
---
## Thay đổi hiện tại
!`git diff HEAD`

## Hướng dẫn
Tóm tắt 2-3 gạch đầu dòng, liệt kê rủi ro...
```

- `` !`lệnh` `` = **dynamic context injection**, chạy *trước* khi Claude thấy nội dung; lệnh lỗi thì **huỷ toàn bộ lượt gọi skill**. Thêm `|| true` cho lệnh cố tình exit non-zero.
- Biến thay thế: `$ARGUMENTS`, `$0`/`$1`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_SESSION_ID}`.
- Skill và slash command dùng chung cơ chế: `.claude/skills/deploy/SKILL.md` và `.claude/commands/deploy.md` đều tạo `/deploy`.
- Stack nhiều skill trong 1 tin nhắn: `/write-tests /fix-issue 123`.

**Vòng đời — ảnh hưởng trực tiếp tới cách viết:**

> Nội dung SKILL.md sau khi render vào hội thoại thì **nằm đó suốt phiên**; Claude Code không đọc lại file ở các lượt sau.

⇒ Viết dạng **luật thường trực**, đừng viết "bước 1 xong rồi thôi". Giữ SKILL.md **dưới 500 dòng**, đẩy tài liệu chi tiết sang file phụ (`reference.md`, `examples.md`, `scripts/`) và tham chiếu từ SKILL.md. Sau `/compact`, các skill đã gọi được gắn lại trong ngân sách giới hạn (5.000 token đầu mỗi skill, tổng 25.000) — skill cũ có thể bị rơi hẳn.

**Bundled skills:** `/doctor`, `/code-review`, `/debug`, `/batch`, `/loop`, `/run`, `/verify`, `/run-skill-generator`. Tắt bằng `disableBundledSkills`.

**Điều khiển từ settings, không sửa SKILL.md** (hữu ích với skill do team commit):

```json
{ "skillOverrides": { "legacy-context": "name-only", "deploy": "off" } }
```
4 trạng thái: `on` / `name-only` (chỉ hiện tên, tiết kiệm ngân sách listing) / `user-invocable-only` / `off`.

### 4.4 Auto memory — **mảng thiếu hoàn toàn ở bản cũ**

Claude Code có **hai** hệ nhớ song song:

| | CLAUDE.md | Auto memory |
|---|---|---|
| Ai viết | Bạn | Claude |
| Nội dung | Luật, quy ước | Bài học, pattern nó tự rút ra |
| Phạm vi | Project / user / org | Theo repository (chia sẻ giữa các worktree) |
| Nạp | Mỗi phiên, **toàn bộ** | Mỗi phiên, **200 dòng đầu hoặc 25KB** của `MEMORY.md` |

Vị trí: `~/.claude/projects/<project>/memory/` — gồm `MEMORY.md` (index, luôn nạp) + các file chủ đề (`debugging.md`, `api-conventions.md`… chỉ đọc khi cần). Bật/tắt: toggle trong `/memory`, hoặc `autoMemoryEnabled` trong settings, hoặc `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Đổi chỗ lưu: `autoMemoryDirectory`. Máy-local, không đồng bộ giữa các máy.

Khi bạn nói "nhớ là luôn dùng pnpm chứ đừng dùng npm", nó vào **auto memory**. Muốn vào CLAUDE.md thì phải nói rõ "thêm vào CLAUDE.md".

Codex có cơ chế tương đương (**Memories / Chronicle**), VS Code có **Memory**.

### 4.5 Flow

```
Khởi động phiên
        │
        ▼
① CLAUDE.md: managed → ~/.claude/CLAUDE.md → ./CLAUDE.md (+ .local)
   (nối vào nhau, gần CWD nhất đọc sau cùng)
   + auto memory: 200 dòng đầu của MEMORY.md
        │
        ▼
② .claude/rules: user-level trước, project sau
   (không có paths → nạp ngay; có paths → chờ Claude đọc file khớp)
        │
        ▼
③ Quét name + description của mọi SKILL.md (ngân sách 1% context window)
        ├─ Khớp (và paths khớp nếu có) → nạp toàn bộ, GIỮ NGUYÊN SUỐT PHIÊN
        ├─ /skill-name → ép nạp
        └─ Không khớp → dùng ① + ②
        │
        ▼
④ CLAUDE.md thư mục con + skill thư mục con: nạp on-demand khi Claude
   thực sự đọc/sửa file trong đó
```

**Sau `/compact`:** CLAUDE.md ở project root **được đọc lại và tiêm lại**. CLAUDE.md thư mục con và rule có `paths` thì **không** — chúng chỉ quay lại khi Claude đọc file khớp lần nữa. Nếu một chỉ dẫn "biến mất" sau compact, đây thường là lý do.

---

## 5. Bảng so sánh tổng hợp

| | **GitHub Copilot** | **Codex CLI** | **Claude Code** |
|---|---|---|---|
| Luôn bật (project) | `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md` | `AGENTS.md` (mỗi thư mục) | `CLAUDE.md` / `.claude/CLAUDE.md` (mỗi thư mục) |
| Luôn bật (user) | `~/.copilot/instructions`, `~/.claude/rules` | `~/.codex/AGENTS.md` | `~/.claude/CLAUDE.md` |
| Riêng tư, không commit | — | `AGENTS.override.md` | `CLAUDE.local.md` |
| Path-scoped | `applyTo` glob · `.claude/rules` + `paths` | *(theo vị trí thư mục)* | `.claude/rules` + `paths`, **và** `paths` trong SKILL.md |
| Skill — global | `~/.copilot/skills`, `~/.claude/skills`, `~/.agents/skills` | `~/.agents/skills` | `~/.claude/skills` |
| Skill — project | `.github/skills`, `.claude/skills`, `.agents/skills` | `.agents/skills` (mọi cấp CWD→root) | `.claude/skills` (kể cả thư mục con, nạp on-demand) |
| Skill — tổ chức | enterprise policy | `/etc/codex/skills` | managed settings |
| Trùng tên skill | — | không gộp, cả hai cùng hiện | **enterprise > personal > project** |
| `name` trong SKILL.md | **bắt buộc, phải trùng tên thư mục** | bắt buộc | chỉ là nhãn; tên lệnh = tên thư mục |
| Chặn auto-trigger | `disable-model-invocation: true` | `allow_implicit_invocation: false` | `disable-model-invocation: true` |
| Chạy trong subagent | `context: fork` (thử nghiệm) | subagents | `context: fork` + `agent` + `background` |
| Chèn output lệnh vào body | ❌ | ❌ | `` !`cmd` `` |
| Memory tự động | Memory | Memories / Chronicle | Auto memory (`MEMORY.md`) |
| Phân phối | Agent plugins | Plugins | Plugins / marketplace |

---

## 6. Viết SKILL.md dùng chung cho cả 3 nền tảng

Bản cũ nói "chỉ cần `name` + `description`" — chưa đủ chính xác. Thực tế:

**Bộ field an toàn tuyệt đối** (spec agentskills.io, cũng là bộ được chấp nhận khi upload lên claude.ai / Skills API):
`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.

Nếu để lẫn field ngoài spec (ví dụ `argument-hint`) thì việc đóng gói/upload **lỗi cứng**, chứ không bỏ qua field đó. Còn trong Claude Code thì mọi field đều chạy bình thường.

**Checklist skill portable:**

- [ ] `name` **trùng tên thư mục cha**, chữ thường + gạch ngang, ≤64 ký tự — bắt buộc với Copilot, vô hại với 2 nền tảng kia.
- [ ] `description` ≤ ~1000 ký tự, **use case chính đặt ở câu đầu** (phần đuôi bị cắt trước khi ngân sách tràn).
- [ ] Trong description có **từ khoá người dùng thật sự sẽ gõ**, không phải thuật ngữ nội bộ.
- [ ] Body ≤ 500 dòng; tài liệu dài đẩy sang file phụ, tham chiếu bằng **link Markdown tương đối** (Copilot chỉ đọc file phụ nếu được tham chiếu như vậy).
- [ ] Không dùng `` !`cmd` `` nếu cần chạy trên Copilot/Codex — chỉ Claude Code hiểu.
- [ ] Field riêng của từng nền tảng (`paths`, `context`, `model`, `policy` trong `agents/openai.yaml`) tách riêng, đừng nhồi vào file chung.

**Mẹo:** trỏ symlink `~/.claude/skills` ↔ `~/.agents/skills` để dùng chung một bộ skill cá nhân — cả 3 nền tảng đều hỗ trợ symlink.

---

## 7. Phân phối và bảo mật

**Phân phối** — cả 3 đã chuyển sang **plugin** làm đơn vị phân phối chính thay vì copy thư mục thủ công:

| | Cơ chế |
|---|---|
| Copilot | Agent plugins; skill của plugin có tiền tố `/my-plugin:skill-name` |
| Codex | Plugins (gói nhiều skill + MCP config + app mapping) |
| Claude Code | Plugins/marketplace: `/plugin marketplace add`, `/plugin install` |

Cấp độ chia sẻ tăng dần: **commit vào repo** (`.claude/skills/`, `.agents/skills/`, `.github/skills/`) → **plugin** → **managed/enterprise settings**.

**Bảo mật — phần bản cũ chưa nhắc:**

- Skill commit trong repo có thể **tự cấp quyền tool** qua `allowed-tools`. Trên Claude Code, `allowed-tools` của project skill chỉ có hiệu lực sau khi bạn accept workspace trust dialog — **hãy review skill trước khi trust một repo lạ**.
- `disableSkillShellExecution: true` chặn `` !`cmd` `` cho skill từ user/project/plugin (không ảnh hưởng bundled/managed). Nên đặt ở managed settings.
- Chặn skill cụ thể qua permission rule: `Skill(deploy *)` trong deny rules; chặn hết bằng cách deny tool `Skill`.
- Codex: dùng `prefix_rule` với `decision = "forbidden"` cho lệnh nguy hiểm; admin ép được qua `requirements.toml`.
- Copilot: terminal tool có auto-approve allow-list — review kỹ khi dùng skill của người khác.

---

## 8. Áp dụng cho case HomeMan

Flow 10 skill hiện tại (`interview-me → idea-refine → spec-driven-development → planning-and-task-breakdown → incremental-implementation → test-driven-development → code-review-and-quality → security-and-hardening → ci-cd-and-automation → shipping-and-launch`) đang để **global** ở `.agents\skills\`.

**1. Giữ global hay tách project?**
- Phần *generic* (cách phỏng vấn yêu cầu, cách viết spec, checklist TDD) → giữ global. Đúng.
- Phần *gắn cứng HomeMan* (tên project, đường dẫn `docs/spec/homestay-management-spec.md`) → tách sang project scope. ⚠️ **Khi tách, đổi tên skill** (ví dụ `homeman-spec-writer` thay vì `spec-driven-development`) — vì với Claude Code, skill **personal ghi đè project**, giữ nguyên tên thì bản project sẽ không bao giờ chạy.

**2. Tạo file luôn-bật ở root HomeMan.** Vì bạn xài cả 3 agent, cách gọn nhất là **một nguồn duy nhất**:

```
HomeMan/
├── AGENTS.md          ← nguồn thật: stack, lệnh build/test, convention (ngắn!)
├── CLAUDE.md          ← chỉ 2 dòng: "@AGENTS.md" + phần riêng cho Claude
└── .github/
    └── copilot-instructions.md   ← hoặc để trống, Copilot đọc được AGENTS.md
```

**3. Rà lại `description` của 10 skill.** Với 10 skill trong một chuỗi, rủi ro lớn nhất là mô tả **na ná nhau** → agent chọn nhầm bước. Mỗi cái nên mở đầu bằng điều kiện kích hoạt cụ thể:

> ✅ `description: Dùng khi bắt đầu một tính năng mới và cần phỏng vấn yêu cầu từ đầu. Kích hoạt khi người dùng nói "tôi muốn làm tính năng X", "giúp tôi làm rõ yêu cầu".`
> ❌ `description: Phỏng vấn để thu thập yêu cầu.`

Với Claude Code, tách phần trigger phrase sang `when_to_use` cho gọn. Dùng `/doctor` để xem 10 skill này đang ăn bao nhiêu context; skill nào ít dùng thì đặt `"name-only"` trong `skillOverrides` để nhường ngân sách.

**4. Cân nhắc `paths` cho skill** (Claude Code): ví dụ `code-review-and-quality` gắn `paths: "src/**"`, `ci-cd-and-automation` gắn `paths: [".github/workflows/**", "**/*.yml"]` — skill chỉ hiện khi đang làm đúng vùng đó, vừa tiết kiệm ngân sách listing vừa giảm chọn nhầm.

**5. Chuỗi tuần tự thì nên gọi tay.** Các bước có side effect (`shipping-and-launch`, `ci-cd-and-automation`) nên đặt `disable-model-invocation: true` để agent không tự ý chạy khi thấy code "trông có vẻ xong".

---

## 9. Sơ đồ quyết định nhanh

```
Đây là fact/quy ước LUÔN cần biết (stack, convention, lệnh build)?
├── Có, toàn codebase
│   └── AGENTS.md (+ CLAUDE.md import nó) / copilot-instructions.md
├── Có, chỉ 1 vùng code
│   ├── Copilot → *.instructions.md (applyTo)
│   ├── Codex   → AGENTS.md đặt trong đúng thư mục
│   └── Claude  → .claude/rules/*.md (paths)
│       ⚠️ nếu luật áp dụng lúc TẠO file mới → paths không kích hoạt,
│          để ở CLAUDE.md hoặc dùng hook
├── Không, đây là QUY TRÌNH nhiều bước / kỹ năng chuyên biệt
│   └── SKILL.md
│       ├── Chỉ project này → PROJECT scope (nhớ đổi tên tránh bị personal đè)
│       ├── Mọi project     → USER/GLOBAL scope
│       ├── Có side effect  → + disable-model-invocation: true
│       ├── Dài / nhiều bước điều tra → + context: fork
│       └── Chỉ liên quan 1 vùng code → + paths (Claude Code)
└── Không, đây là thứ agent nên TỰ rút ra qua thời gian
    └── để auto memory làm — chỉ cần đọc/dọn định kỳ
```

**Ranh giới CLAUDE.md vs rules vs skill:** một mục trong CLAUDE.md mà đã phình thành *quy trình nhiều bước*, hoặc chỉ liên quan tới *một phần codebase*, thì nó không còn thuộc về CLAUDE.md nữa — chuyển thành skill hoặc path-scoped rule.

---

## 10. Kiểm chứng — phần quan trọng nhất khi tài liệu và thực tế lệch nhau

| | Lệnh / thao tác |
|---|---|
| **Claude Code** | `/context` → xem **Memory files** và dòng **Skills** (những gì thực sự nạp)<br>`/memory` → duyệt & sửa CLAUDE.md + auto memory<br>`/doctor` → ước lượng chi phí context của listing skill, đề xuất trim CLAUDE.md<br>`claude --debug` → lỗi parse frontmatter, cảnh báo tràn ngân sách<br>hook `InstructionsLoaded` → log chính xác file nào nạp, lúc nào, vì sao |
| **Codex** | `/skills` duyệt skill · `$tên-skill` gọi tay<br>`codex execpolicy check --rules ... -- <lệnh>` test rule |
| **Copilot** | Chuột phải trong Chat view → **Diagnostics**: xem mọi file instruction đã nạp + lỗi<br>Mục **References** trong câu trả lời: instruction nào được dùng<br>`Chat: Configure Instructions` → hover để biết file đến từ đâu |

**Triệu chứng → nguyên nhân thường gặp:**

| Triệu chứng | Nghi ngờ đầu tiên |
|---|---|
| Skill không bao giờ tự chạy | `description` thiếu từ khoá; hoặc mô tả bị cắt do tràn ngân sách; hoặc `disable-model-invocation` |
| Skill im lặng không load (Copilot) | `name` không trùng tên thư mục, hoặc có ký tự lạ |
| Instruction user-level không ăn (VS Code) | Đang bật Agent Host → phải để ở `~/.copilot/instructions` hoặc `~/.claude/rules` |
| Rule `paths` không nạp | Glob chưa bọc nháy; hoặc Claude chưa *đọc* file nào khớp; hoặc trúng bug user-level |
| Chỉ dẫn "biến mất" giữa chừng | Vừa `/compact` — CLAUDE.md thư mục con và rule `paths` không tự tiêm lại |
| Skill có vẻ hết tác dụng sau lượt đầu | Nội dung vẫn còn trong context, model chọn cách khác — siết `description`, hoặc dùng hook để cưỡng chế |

---

## 11. Nguồn tham khảo chính thức

**GitHub Copilot / VS Code**
- Agent Skills: https://code.visualstudio.com/docs/agent-customization/agent-skills
- Custom instructions: https://code.visualstudio.com/docs/agent-customization/custom-instructions
- Agent plugins: https://code.visualstudio.com/docs/agent-customization/agent-plugins
- Customization concepts: https://code.visualstudio.com/docs/agents/concepts/customization
- Repository instructions: https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide

**OpenAI Codex**
- Agent Skills: https://developers.openai.com/codex/skills
- Record & Replay: https://developers.openai.com/codex/record-and-replay
- AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Rules (sandbox/lệnh): https://developers.openai.com/codex/rules
- Plugins: https://developers.openai.com/codex/plugins/build
- Memories: https://developers.openai.com/codex/memories

**Claude Code**
- Skills: https://code.claude.com/docs/en/skills
- Memory (CLAUDE.md + auto memory): https://code.claude.com/docs/en/memory
- Debug your config: https://code.claude.com/docs/en/debug-your-config
- Monorepos: https://code.claude.com/docs/en/large-codebases
- Agent Skills overview: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

**Chuẩn mở**
- Spec: https://agentskills.io/specification
- Skill repos: github.com/anthropics/skills · github.com/openai/skills · github.com/github/awesome-copilot

---

## Phụ lục — Danh sách thay đổi so với bản trước

**Đã sửa**

1. Thứ tự ưu tiên instruction Copilot: 5 bậc → **3 bậc**; `copilot-instructions.md` và `AGENTS.md` cùng bậc.
2. `CLAUDE.local.md` **không** deprecated.
3. `context: fork` **không** phải riêng Claude Code — Copilot cũng có.
4. Vị trí skill Copilot: thêm `.claude/skills`, `.agents/skills` (project) và `~/.copilot/skills`, `~/.agents/skills` (personal).
5. Instruction user-level Copilot: `%APPDATA%\Code\User\prompts\` → `~/.copilot/instructions`, `~/.claude/rules` (Agent Host).
6. Phân biệt "Rules" của Codex (kiểm soát lệnh, Starlark) với `.claude/rules` (instruction).
7. Trùng tên skill Claude Code: **enterprise > personal > project**, ngược với quy tắc "càng cụ thể càng thắng".
8. Ràng buộc `name`: bắt buộc trùng thư mục ở Copilot, chỉ là nhãn ở Claude Code.
9. Bộ field chuẩn mở là **6 field**, không phải chỉ `name` + `description`.
10. `.claude/rules`: thêm user-level, cách kích hoạt (khi *đọc* file), yêu cầu quote glob, các bug đang mở.

**Đã bổ sung**

Auto memory (mục 4.4) · interop AGENTS.md ↔ CLAUDE.md · `@path` import · vòng đời skill trong context · ngân sách description của Claude Code · `paths` trong SKILL.md · `skillOverrides` / `claudeMdExcludes` / managed policy · hành vi sau `/compact` · plugin làm kênh phân phối (mục 7) · bảo mật skill · checklist skill portable (mục 6) · bảng lệnh kiểm chứng và triệu chứng→nguyên nhân (mục 10) · Codex `[[skills.config]]`, `$skill-installer`, Record & Replay.
