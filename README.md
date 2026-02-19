# `napcat-plugin-zanwo`

NapCat 点赞插件，支持给自己或指定用户点赞。

## 命令

| 命令 | 说明 |
|------|------|
| `.zanwo` | 给自己点赞 10 次（默认） |
| `.zanwo <次数>` | 给自己点赞指定次数 |
| `.zan @用户 [次数]` | 给 @用户 点赞（次数默认 1） |
| `.zan <QQ号> [次数]` | 给指定 QQ 号点赞 |

次数范围 1–20，超出自动截断。

所有命令支持 @机器人 触发，例如：

```
@bot .zanwo 5
@bot .zan @某人 10
```

## 安装

将 `dist/` 目录复制到 NapCat 插件目录，在 WebUI 中启用即可。

## 开发

```bash
pnpm install

# 构建
pnpm run build

# 监听模式（配合 napcat-plugin-debug 热重载）
pnpm run dev

# 类型检查
pnpm run typecheck
```

构建产物在 `dist/` 目录下：

```
dist/
├── index.mjs       # 插件入口
└── package.json    # 元信息
```

## 项目结构

```
src/
└── index.ts    # 全部逻辑，~100 行
```

## 许可证

GNU General Public License 3.0. 更多信息请查看 [LICENSE](./LICENSE)。
