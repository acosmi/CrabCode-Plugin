# 人工发布包运行手册

1. 最终变体保存为 reviewed manifest。
2. readiness 检查事实、原创、法律、披露、profile、资源权利和规则时效。
3. request 生成 pending 审批；人工通过 decide 记录 approved/rejected/revoked。
4. package 只接收 contentId、approvalId 和 packagedBy，重新检查当前 hash。
5. 包内包含 manifest、Markdown、HTML、标题、摘要、检查单和实际复制的 assets。
6. 人工在平台后台再次核对规则、披露与资源后完成发布。

真平台 API、浏览器最终点击和自动评论属于 Gate B。不得伪造发布成功。
