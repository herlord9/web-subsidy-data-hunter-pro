# GitHub 仓库初始化指南

## 📋 准备工作

在开始之前，你需要准备以下信息：

1. **GitHub 账号** - 确保你已经注册了 GitHub 账号
2. **仓库名称** - **固定为 `web-subsidy-data-hunter-pro`**（必须使用此名称）
3. **仓库可见性** - Public（公开）或 Private（私有）
4. **认证方式** - **推荐使用 SSH**（如果你已配置 SSH key，直接使用 SSH 方式）

## 🚀 初始化步骤

### 步骤 1：在 GitHub 上创建仓库

1. 登录 GitHub
2. 点击右上角的 **"+"** → **"New repository"**
3. 填写仓库信息：
   - **Repository name**: `web-subsidy-data-hunter-pro`（**必须使用此名称**）
   - **Description**: `专业的网页数据猎取工具浏览器扩展`
   - **Visibility**: 选择 Public 或 Private
   - **不要**勾选 "Initialize this repository with a README"（因为本地已有代码）
4. 点击 **"Create repository"**

### 步骤 2：配置本地 Git（如果还没配置）

```bash
# 设置用户名和邮箱（如果还没设置）
git config --global user.name "你的名字"
git config --global user.email "your-email@example.com"
```

### 步骤 3：初始化本地仓库并提交代码

```bash
# 进入项目目录
cd e:\bbb-test\data-hunter-pro

# 初始化 Git 仓库（如果还没有初始化）
git init

# 添加所有文件
git add .

# 创建初始提交
git commit -m "Initial commit: Data Hunter Pro - 专业的网页数据猎取工具"

# 重命名分支为 main（如果当前是 master）
git branch -M main
```

### 步骤 4：连接远程仓库

#### 方式一：使用 SSH（推荐，如果你已配置 SSH key）

**如果你已经在 GitHub 上配置了 SSH key，直接使用此方式。**

1. **检查 SSH key 是否已配置**：
   ```bash
   # 测试 SSH 连接
   ssh -T git@github.com
   ```
   
   如果看到 "Hi username! You've successfully authenticated..." 说明 SSH key 已配置好

2. **添加远程仓库**：
   ```bash
   # 替换 YOUR_USERNAME 为你的 GitHub 用户名
   git remote add origin git@github.com:YOUR_USERNAME/web-subsidy-data-hunter-pro.git
   
   # 例如：
   # git remote add origin git@github.com:yourusername/web-subsidy-data-hunter-pro.git
   ```

3. **推送代码**：
   ```bash
   git push -u origin main
   ```

#### 方式二：使用 HTTPS（备选方案）

如果你没有配置 SSH key，可以使用 HTTPS 方式：

1. **创建个人访问令牌（Personal Access Token）**：
   - 访问：https://github.com/settings/tokens
   - 点击 **"Generate new token"** → **"Generate new token (classic)"**
   - 填写 Note（例如：`web-subsidy-data-hunter-pro`）
   - 选择过期时间（建议选择较长时间）
   - 勾选权限：至少勾选 `repo`（完整仓库访问权限）
   - 点击 **"Generate token"**
   - **重要**：复制生成的 token（只显示一次，请妥善保存）

2. **添加远程仓库**：
   ```bash
   # 替换 YOUR_USERNAME 为你的 GitHub 用户名
   git remote add origin https://github.com/YOUR_USERNAME/web-subsidy-data-hunter-pro.git
   ```

3. **推送代码**：
   ```bash
   git push -u origin main
   ```
   
   当提示输入用户名时，输入你的 GitHub 用户名
   当提示输入密码时，**粘贴刚才复制的 Personal Access Token**（不是你的 GitHub 密码）

#### 如何配置 SSH key（如果还没有配置）

1. **检查是否已有 SSH 密钥**：
   ```bash
   # Windows PowerShell
   ls ~/.ssh
   
   # 或 Windows CMD
   dir %USERPROFILE%\.ssh
   ```
   
   如果看到 `id_rsa.pub` 或 `id_ed25519.pub`，说明已有密钥，跳到第 3 步

2. **生成 SSH 密钥**（如果没有）：
   ```bash
   # Windows (Git Bash 或 PowerShell)
   ssh-keygen -t ed25519 -C "your-email@example.com"
   
   # 按 Enter 使用默认路径
   # 可以设置密码（可选，更安全）
   ```

3. **添加 SSH 密钥到 GitHub**：
   - 复制公钥内容：
     ```bash
     # Windows PowerShell
     cat ~/.ssh/id_ed25519.pub
     
     # 或 Windows CMD
     type %USERPROFILE%\.ssh\id_ed25519.pub
     ```
   - 访问：https://github.com/settings/keys
   - 点击 **"New SSH key"**
   - Title: 填写描述（例如：`My Windows PC`）
   - Key: 粘贴刚才复制的公钥内容
   - 点击 **"Add SSH key"**

4. **测试 SSH 连接**：
   ```bash
   ssh -T git@github.com
   ```
   
   如果看到 "Hi username! You've successfully authenticated..." 说明配置成功

5. **然后按照"方式一：使用 SSH"的步骤继续**

## ✅ 验证

推送成功后，访问你的 GitHub 仓库页面，应该能看到所有代码文件。

## 🔄 后续更新

以后每次修改代码后，使用以下命令提交：

```bash
# 查看修改
git status

# 添加修改的文件
git add .

# 提交
git commit -m "描述你的修改"

# 推送到 GitHub
git push
```

## 📝 常用命令

```bash
# 查看远程仓库
git remote -v

# 修改远程仓库地址（SSH）
git remote set-url origin git@github.com:YOUR_USERNAME/web-subsidy-data-hunter-pro.git

# 或修改为 HTTPS
git remote set-url origin https://github.com/YOUR_USERNAME/web-subsidy-data-hunter-pro.git

# 查看提交历史
git log

# 查看当前状态
git status
```

## ❓ 常见问题

### Q: 推送时提示 "Permission denied"
A: 
- HTTPS 方式：检查 Personal Access Token 是否正确，是否有 `repo` 权限
- SSH 方式：检查 SSH 密钥是否已添加到 GitHub

### Q: 推送时提示 "remote: Support for password authentication was removed"
A: GitHub 已不再支持密码认证，必须使用 Personal Access Token（HTTPS）或 SSH 密钥

### Q: 如何删除远程仓库连接？
A: `git remote remove origin`

### Q: 如何查看当前的远程仓库？
A: `git remote -v`

