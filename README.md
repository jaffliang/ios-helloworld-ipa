# ios-helloworld-ipa

## 项目定位

本项目用于构建 iOS 应用的未签名 IPA（`HelloWorld.ipa`），主要运行形态为 Capacitor WebView 应用。

## 主要技术规范

- 开发机环境：Windows（不依赖本地 Xcode 构建）
- 构建方式：GitHub Actions（`macos-15`）远程构建 IPA
- 前端入口目录：`www/`
- Capacitor 配置文件：`capacitor.config.json`
- App ID / Bundle ID：`com.jaffliang.helloworld`
- 最低 iOS 版本：`iOS 14.0`
- 关键依赖：
  - `@capacitor/cli` `^6.1.2`
  - `@capacitor/ios` `^6.1.2`
  - `@capacitor/device` `^6.0.0`
  - `@capacitor/network` `^6.0.0`
  - `@capacitor/haptics` `^6.0.0`
  - `@capacitor/local-notifications` `^6.0.0`
  - `@capacitor/clipboard` `^6.0.0`

## 构建与发布规范（GitHub Actions）

工作流文件：`.github/workflows/build-ios-ipa.yml`

标准流程如下：

1. `npm install`
2. 校验 Capacitor 插件依赖已安装（`npm ls ...`）
3. `npx cap sync ios`
4. `xcodebuild` 构建 Release（关闭签名）
5. 打包 `Payload/App.app` 为 `HelloWorld.ipa`
6. 创建 GitHub Release 并上传 IPA
7. 额外上传 Artifact 备份（保留 30 天）

触发方式：

- 推送到 `main`
- 手动触发 `workflow_dispatch`

## 注意事项（务必遵守）

- 本机是 Windows，不能把“本地能编译/运行 iOS”作为验证前提。
- 功能是否修复（例如震动/Haptics）必须以 GitHub Actions 产物安装到巨魔手机后的实机结果为准。
- 当前工作流输出的是未签名 IPA，安装方式需符合你的巨魔使用链路。
- 每次改动 `www/` 或 Capacitor 插件依赖后，都应确保 CI 执行了 `npx cap sync ios`，避免网页层与原生层不同步。
- 若插件调用存在但实机无效果，优先检查三项：
  - 依赖是否真实安装（`npm install` 后无缺失）
  - `cap sync ios` 是否成功执行
  - Release 中的 IPA 是否来自最新提交

## 建议验证清单（震动功能示例）

1. 修改代码并推送到 `main`
2. 等待 GitHub Actions 成功
3. 下载 Release 中的最新 `HelloWorld.ipa`
4. 安装到巨魔手机
5. 打开“震动测试”按钮执行实测
6. 记录结果（是否触发、触发强度、机型和系统版本）
