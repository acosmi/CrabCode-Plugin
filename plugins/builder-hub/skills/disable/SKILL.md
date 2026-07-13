---
name: 技能启停管理
short-description: 启用或禁用已安装技能，无需卸载即可控制能力可用状态
description: 启用或禁用已安装的技能,无需卸载即可临时关闭某个能力。当用户提到禁用技能、关闭某个 skill、暂时停用插件、重新启用之前关掉的能力,或需要切换技能开关状态时使用本技能(即使未明说"禁用")。
argument-hint: "[技能名] [enable|disable]"
---

# /builder-hub:disable

在不卸载的前提下,启用或禁用已安装的技能。

## Workflow

1. 确认目标技能(skill)目录名与期望状态:启用(enable)或禁用(disable)。
2. 读取当前状态:从 `marketplace.json`(或本地已装清单)中查得该技能的启用标记。
3. 切换开关:
   - 禁用:将该技能标记为 disabled,使其不再被加载或推荐,但保留文件。
   - 启用:将标记恢复为 enabled。
4. 校验联动:若禁用项被其他启用技能依赖,提示可能的功能缺失。
5. 写回登记,记录状态变更。

## Output

返回:

- 目标技能名称及变更前后的状态。
- 受影响的依赖技能提示(若有)。
- 当前所有被禁用技能的简表。

## Next Steps

- 用 `/builder-hub:skill-manager` 查看全部技能的启用/禁用总览。
- 如确认长期不用,用 `/builder-hub:uninstall` 彻底卸载。
- 用 `/builder-hub:related-skills-surfacer` 寻找可替代的启用项。
