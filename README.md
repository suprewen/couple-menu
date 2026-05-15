# Couple Menu

给情侣使用的本地优先点菜小岛。目标是在 30 秒内从“不知道吃什么”变成“今晚就吃这个”。

## 功能

- 示例菜单，首次打开即可使用
- 添加、编辑、删除菜品
- 分类、标签、搜索、双方偏好筛选
- “我 / TA” 两人的想吃、一般、不想吃标记
- 按偏好和最近吃过加权的随机推荐
- 今日推荐、决定卡片、标记已吃、收藏
- localStorage 本地持久化
- JSON 导入 / 导出，方便备份和迁移

## 技术栈

- Vite
- React
- TypeScript
- 手写 CSS
- localStorage

## 设计边界

视觉参考温暖圆润的岛屿菜单氛围：木牌、便签、柔和绿色、米色、暖黄、厚底按钮。

没有复制 animal-island-ui 的源码、CSS、图片、SVG、字体或任天堂 / 动森相关素材。所有 UI 均为项目内自写 CSS 和文本符号。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物在 `dist/`，可部署到 Cloudflare Pages / Vercel / Netlify 等静态托管服务。
