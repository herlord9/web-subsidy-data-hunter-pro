# GitHub 提交说明

## 📋 快速开始

详细的初始化步骤请查看 [GITHUB_SETUP.md](./GITHUB_SETUP.md)

## 🚀 快速推送步骤

### 1. 在 GitHub 上创建仓库

访问 https://github.com/new 创建新仓库（不要初始化 README）

### 2. 初始化本地仓库（如果还没初始化）

```bash
cd e:\bbb-test\data-hunter-pro

# 如果还没初始化
git init
git add .
git commit -m "Initial commit: Data Hunter Pro"
git branch -M main
```

### 3. 连接远程仓库并推送

#### 使用 HTTPS（需要 Personal Access Token）

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
# 仓库名称固定为 web-subsidy-data-hunter-pro
git remote add origin https://github.com/YOUR_USERNAME/web-subsidy-data-hunter-pro.git

# 推送代码
git push -u origin main
```

**注意**：推送时会要求输入用户名和密码，密码处需要输入 [Personal Access Token](https://github.com/settings/tokens)

#### 使用 SSH（推荐，如果你已配置 SSH key）

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
# 仓库名称固定为 web-subsidy-data-hunter-pro
git remote add origin git@github.com:YOUR_USERNAME/web-subsidy-data-hunter-pro.git

# 推送代码
git push -u origin main
```

**提示**：如果你已经在 GitHub 上配置了 SSH key，直接使用此方式，无需输入密码。

## 📝 需要的信息

在开始之前，你需要：

1. ✅ **GitHub 账号** - 已注册 GitHub
2. ✅ **仓库名称** - **固定为 `web-subsidy-data-hunter-pro`**（必须使用此名称）
3. ✅ **认证方式**：
   - **SSH**（推荐）：如果你已配置 SSH key，直接使用此方式
   - **HTTPS**（备选）：需要创建 [Personal Access Token](https://github.com/settings/tokens)

## 🔄 后续更新

```bash
git add .
git commit -m "描述你的修改"
git push
```

## 📚 详细文档

完整的初始化指南请查看：[GITHUB_SETUP.md](./GITHUB_SETUP.md)


