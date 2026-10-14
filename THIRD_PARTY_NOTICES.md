# 第三方资源

- Noto Sans SC 字体：SIL Open Font License 1.1，许可证随附于 `cloudfunctions/medicalApi/fonts/OFL.txt`。`font-data.js` 是供云端导出使用的字体编码副本，同样遵循该字体许可证。
- 行政区划数据：来源为 [modood/Administrative-divisions-of-China](https://github.com/modood/Administrative-divisions-of-China)，WTFPL，具体来源和数据范围见 `cloudfunctions/medicalApi/region-data/SOURCE.md`。
- npm 依赖：各自遵循对应软件包许可证，版本记录于 `cloudfunctions/medicalApi/package-lock.json`。`vendor/lodash-set` 与 `vendor/lodash-unset` 为调用 Lodash 维护入口的包装模块。
- 图标：`images/notion/` 的线性图标由 `scripts/draw-ui-icons.py` 生成。设计参考链接见 `docs/设计与调研.md`。
- `quickstartFunctions`、`pages/example`、`components/cloudTipModal` 及相关云开发引导图片为保留的微信云开发起始模板内容，主业务使用 `medicalApi`。
