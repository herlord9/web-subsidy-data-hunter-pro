# 调试方城县网站抓取问题

## 问题描述
在方城县网站搜索页面无法抓取到列表项，报错："No list items found"

## 测试页面
https://www.fangcheng.gov.cn/search/?foot_h=271&keywords=%E8%80%95%E5%9C%B0%E5%9C%B0%E5%8A%9B

## 页面结构
- 列表容器：`ul#new-list` 或 `ul.new-list`
- 列表项数量：15 个 li
- 每个 li 包含：标题链接、URL、日期

## 调试步骤

### 1. 在浏览器控制台运行以下代码检查列表

```javascript
// 检查列表是否存在
const ul = document.querySelector('ul#new-list');
console.log('找到 ul#new-list:', !!ul);
console.log('li 数量:', ul?.querySelectorAll('li').length);

// 查看第一个 li 的内容
const firstLi = ul?.querySelectorAll('li')[0];
console.log('第一个 li 的文本:', firstLi?.textContent?.substring(0, 100));
console.log('第一个 li 包含链接:', !!firstLi?.querySelector('a[href]'));
```

### 2. 检查插件的识别逻辑

在控制台运行：

```javascript
// 测试 findListContainer 的策略
const searchResultLists = document.querySelectorAll('ul[id*="list"], ul[class*="list"]');
console.log('找到带 list 的 ul 数量:', searchResultLists.length);

searchResultLists.forEach((list, i) => {
  const items = list.querySelectorAll('li');
  console.log(`第 ${i+1} 个列表:`, {
    id: list.id,
    class: list.className,
    liCount: items.length
  });
});
```

### 3. 测试完整的抓取流程

```javascript
// 模拟完整抓取
const container = document.querySelector('ul#new-list');
const lis = container.querySelectorAll('li');

console.log('=== 抓取测试 ===');
console.log('容器:', container);
console.log('li 数量:', lis.length);

const results = [];
lis.forEach((li, index) => {
  const link = li.querySelector('a[href]');
  const heading = li.querySelector('h3');
  const timeElem = li.querySelector('.times');
  
  if (link) {
    results.push({
      index: index + 1,
      title: heading?.textContent?.trim() || link.textContent?.trim(),
      href: link.href,
      date: timeElem?.textContent?.trim()
    });
  }
});

console.log('抓取结果:', results);
console.log('成功抓取:', results.length, '条');
```

## 已知问题

插件可能在以下情况出错：
1. ❌ 旧版本的插件缓存没有清除
2. ❌ content script 没有正确注入
3. ❌ 列表过滤逻辑有问题

## 解决方案

### 彻底清除插件缓存

1. 进入 `chrome://extensions/`
2. 移除旧的 Data Hunter Pro 插件
3. 重新加载 `dist` 文件夹
4. 刷新测试页面
5. 重新测试

### 手动指定选择器

如果自动识别仍然失败，可以在创建抓取器时：
1. 手动指定选择器为：`#new-list`
2. 或者在插件中选择正确的容器

## 预期结果

应该能抓取到 15 条数据，每条包含：
- title: 文章标题
- href: 文章链接
- date: 发布日期

示例数据：
```json
{
  "title": "涉农补贴2023年耕地地力补贴实施方案",
  "href": "https://www.fangcheng.gov.cn/2023/08-19/630986.html",
  "date": "2023-08-19 03:33:40"
}
```

