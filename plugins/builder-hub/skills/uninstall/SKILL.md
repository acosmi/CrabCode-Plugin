---
name: 技能与插件卸载
short-description: 安全卸载本地技能或插件，并清理对应安装登记
description: 从本地 CrabCode 环境卸载已安装的插件或技能并清理登记。当用户提到卸载技能、删除插件、移除某个 skill、清理不用的能力,或需要从已装清单中摘除条目时使用本技能(即使未明说"卸载")。
argument-hint: "[要卸载的插件名 / 技能名]"
---

# /builder-hub:uninstall

从本地 CrabCode 环境卸载插件或技能,并清理其登记信息。

## Workflow

1. 定位卸载目标:插件 ID 或技能(skill)目录名。
2. 评估影响:
   - 检查是否有其他已装技能依赖该目标。
   - 若存在被依赖关系,先提示用户确认,避免破坏其他能力。
3. 移除文件:删除对应的 `.crabcode-plugin/.../skills/<skill目录名>/` 目录或整个插件目录。
4. 清理登记:在 `marketplace.json`(或本地已装清单)中删除该条目。
5. 校验残留:确认无悬空依赖引用、无遗留空目录。

## Output

返回:

- 已卸载的插件/技能名称与原版本。
- 已删除的路径。
- 受影响的依赖关系(若有)。
- 残留项或需手动清理的提示。

## Next Steps

- 用 `/builder-hub:skill-manager` 复核已装清单是否更新。
- 如为误删,用 `/builder-hub:skill-installer` 重新安装。
- 用 `/builder-hub:registry-browser` 查找替代技能。
