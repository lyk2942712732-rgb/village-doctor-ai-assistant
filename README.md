# 村医 AI 病历助手

面向基层村医的原生微信小程序，使用微信云开发提供后端服务。界面采用简洁的文档工作簿风格。

## 功能

- 微信身份登录，多卫生室创建、加入、切换与成员管理，省市县乡镇村五级地区选择。
- 录音上传与腾讯云 ASR 转写，或手动录入医患沟通内容。
- DeepSeek 整理病历候选字段，村医逐项核对、编辑后确认归档。
- 居民健康档案与历次就诊查询，导出中文 PDF 转诊资料包。
- 按病情复杂度、异常指标和复诊间隔筛选重点居民，人工确认专家接诊名单。
- 专家诊疗与随访记录关联居民档案，各村服务台账和 Excel 导出。
- 卫生室成员绩效统计、负责人移交、成员退出或移除、卫生室解散。

## 技术结构

```text
miniprogram/                 原生小程序页面、组件与业务工具
cloudfunctions/medicalApi/   云函数、权限检查、AI/ASR、PDF/Excel 导出
scripts/                    检查、地区数据构建、图标与案例生成脚本
tests/                      Node.js 自动化测试
docs/                       部署、团队管理与设计说明
```

## 快速开始

1. 将本仓库导入微信开发者工具，设置 `project.config.json` 的 `appid` 为自己的小程序 AppID。
2. 开通微信云开发，在 `miniprogram/config.js` 填写自己的云环境 ID。
3. 按[云开发部署说明](docs/云开发部署.md)创建私有集合并部署 `medicalApi`，设置云函数环境变量。
4. 在开发者工具编译，微信登录后创建或加入卫生室，再开始接诊。

```sh
npm ci --prefix cloudfunctions/medicalApi
npm run check
npm test
```

源码包含案例生成脚本，运行 `node scripts/acceptance-cases.cjs` 前创建 `.artifacts` 目录；该脚本只生成本地案例 JSON，不会自动写入云数据库。仓库不包含线上账号、云数据库导出、服务密钥和预览二维码。

## 配置与业务规则

DeepSeek 使用云函数环境变量 `DEEPSEEK_API_KEY`；腾讯云 ASR 使用 `ASR_SECRET_ID` 和 `ASR_SECRET_KEY`。前端不保存服务密钥。也支持配置其他 OpenAI 兼容接口，详见部署文档。

病历整理结果由村医逐项采用，不自动覆盖手填内容；草稿需确认后归档。重点筛选仅提供参考，专家接诊与人员安排由村医确认。账号与卫生室相互独立，临床数据按卫生室隔离。

- [部署说明](docs/云开发部署.md)
- [卫生室与团队管理](docs/卫生室管理.md)
- [设计与调研](docs/设计与调研.md)
- [第三方资源说明](THIRD_PARTY_NOTICES.md)

## 许可证

项目代码采用 [MIT License](LICENSE)。随附字体和行政区划数据遵循各自许可证，见第三方资源说明。
