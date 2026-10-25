# 他TA星球 · 2026 音乐年终报告

可直接运行的移动端插画 H5 Demo，包含 Loading、授权开启页、视频转场及报告首幕示意。

## 预览与发布

- GitHub Pages：https://nightbeckon.github.io/ta-planet-music-2026/
- 本地预览：在此目录执行 `python3 -m http.server 4178`，打开 http://127.0.0.1:4178/ 。
- 纯静态 HTML/CSS/JavaScript，无依赖安装、无后端和构建步骤。
- Pages 发布来源：main 分支，根目录。保留 `.nojekyll`，所有资源均使用相对路径，适配仓库子路径。

## 功能

- Loading 完成到 100% 后切入主页面。
- 授权默认未勾选，说明可独立阅读。
- 主页面与视频使用真实首帧及相同裁切、调色。
- 云层漂移、星光呼吸、星轨和流星，支持系统减少动态效果。
- 《星光》背景音乐支持播放、暂停、继续和循环，图标同步真实播放状态。首次播放需点击右上角开关。
- 音乐跨页面持续，视频保持静音。后台暂停，前台按用户原有选择续播。
- 弱网与媒体失败提示、跳过和重播。报告数字为示例，不读取或上传个人账号数据。

## 文件

- `index.html`：页面及共享控件。
- `app.js`：流程、授权、进度和音乐状态。
- `journey-video.js` / `journey-video.css`：视频首帧及转场。
- `ambient.js` / `ambient.css`：环境动效。
- `welcome-grade.css`：已确认的主页面调色。
- `assets/`：本项目使用的插画、文字切图、视频、音乐及字体。

## 素材

插画、切图、视频及《星光》由本项目提供，仅供此 Demo 展示，不额外授予素材转载许可。字体与图标许可分别见 `assets/MaShanZheng-LICENSE.txt` 与 `Phosphor-LICENSE.txt`。
