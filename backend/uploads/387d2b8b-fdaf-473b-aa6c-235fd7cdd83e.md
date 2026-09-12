---
title: hexo常用指令
date: 2026-08-23 10:56:57
tags:
- Hexo
- 水贴
categories: 技术文档
cover: /img/hexo常用指令/花火.gif
---
## 基础核心命令
- 初始化blog
  ```bash
  hexo init myblog
  ```
  这会创建一个名为 myblog 的目录，目录下包含博客的所有文件和目录。
- 安装依赖
  ```bash
  npm install
  ```
  这会安装博客的所有依赖，包括主题、插件等。
- 新建一篇文章
  ```bash
  hexo new "我的第一篇文章"
  或者简写为
  hexo n "我的第一篇文章"
  ```
  这会在创建的目录下，新建一个名为 "我的第一篇文章.md" 的文件，文件内容为默认的 Hexo 文章模板。
- 生成静态页面（public文件夹）
  ```bash
  hexo generate
  或者简写为
  hexo g
  ```
  这会在 public 文件夹下生成所有静态页面，包括文章、标签、分类等。
- 本地预览服务器
  ```bash
  hexo server
  或者简写为
  hexo s
  ```
  这会在启动一个本地服务器，你可以在浏览器中访问 [http://localhost:4000](http://localhost:4000) 查看博客。
- 部署到远端
  ```bash
  hexo deploy
  或者简写为
  hexo d
  ```
  这会将本地生成的静态页面部署到远端服务器，包括 GitHub Pages、Netlify 等。
## 组合常用命令
- 生成并本地预览
  ```bash
  hexo generate && hexo server
  ```
  这会先生成静态页面，然后启动本地服务器，你可以在浏览器中访问 [http://localhost:4000](http://localhost:4000) 查看博客。
- 生成并部署到远端
  ```bash
  hexo generate && hexo deploy
  ```
  这会先生成静态页面，然后部署到远端服务器，包括 GitHub Pages、Netlify 等。
- 清理缓存 + 生成静态页面 + 部署到远端
  ```bash
  hexo clean && hexo generate && hexo deploy
  ```
  这会先清理缓存，然后生成静态页面，最后部署到远端服务器。
## 辅助命令
- 清理缓存
  ```bash
  hexo clean
  或者简写为
  hexo c
  ```
  这会清理 Hexo 缓存，包括临时文件、缓存等。
- 草稿文章
  ```bash
  hexo draft "我的草稿文章"
  ```
  这会在草稿目录下，新建一个名为 "我的草稿文章.md" 的文件，文件内容为默认的 Hexo 草稿文章模板。
  ```bash
  hexo publish "我的草稿文章"
  ```
  这会将草稿文章发布到文章目录下，文件名与草稿文章相同。
- 查看版本
  ```bash
  hexo -v
  ```
  这会显示 Hexo 的版本号，包括 Node.js、npm、Hexo 等。
- 强制刷新，预览时监听文件改动
  ```bash
  hexo server --watch
  ```
  这会在启动本地服务器时，监听文件改动，当文件改动时，会自动刷新浏览器。
## 常见踩坑提示
- hexo d 部署失败：检查 _config.yml 的 deploy 配置，确认安装部署插件
  ```bash
  npm install hexo-deployer-git --save
  ```
- 页面不更新，执行
  ```bash
  hexo clean
  ```
  这会清理 Hexo 缓存，包括临时文件、缓存等。
- 本地预览失败，执行
  ```bash
  hexo s -p 端口号
  ```
  这会在启动本地服务器时，指定端口号，默认端口号为 4000。
