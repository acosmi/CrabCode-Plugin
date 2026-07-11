# 示例帧

## 标题帧

```html
<style>
  .s{height:100%;display:flex;flex-direction:column;justify-content:center;padding:80px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;font-family:system-ui}
  h1{font-size:64px;margin:0;animation:in .8s linear both}
  p{font-size:28px;opacity:.85;animation:in 1s linear both}
  @keyframes in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
</style>
<div class="s"><h1>季度增长回顾</h1><p>基于内部财报数据</p></div>
```

## 数据帧

```html
<style>
  .s{height:100%;display:grid;place-items:center;background:#020617;color:#e2e8f0;font-family:system-ui}
  .n{font-size:120px;font-weight:800;color:#38bdf8;animation:pop .6s linear both}
  .l{font-size:32px;margin-top:12px}
  @keyframes pop{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}
</style>
<div class="s"><div><div class="n">128%</div><div class="l">同比 ARR 增长</div></div></div>
```
