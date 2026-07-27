# 业务模板参考

> 本文档帮助 AI 根据探索到的项目特征识别业务类型，并生成对应的管理后台。

## 业务类型识别规则

### 通过数据库 Schema 识别

| 发现的实体 | 推断的业务类型 | 置信度 |
|-----------|---------------|--------|
| post, article, category, tag | blog (博客) | 高 |
| product, order, cart, payment | ecommerce (电商) | 高 |
| shipment, track, station, driver | logistics (物流) | 高 |
| tenant, subscription, plan, invoice | saas (SaaS) | 高 |
| course, lesson, enrollment, student | education (教育) | 高 |
| customer, lead, deal, contact | crm (CRM) | 高 |
| user + 任意实体 | 通用管理后台 | 中 |

### 通过 API 路由识别

| 路由模式 | 推断的业务类型 |
|---------|---------------|
| /api/posts, /api/articles | blog |
| /api/products, /api/orders, /api/cart | ecommerce |
| /api/shipments, /api/tracking | logistics |
| /api/tenants, /api/subscriptions | saas |
| /api/courses, /api/enrollments | education |

### 通过 real.md 关键词识别

| 关键词 | 推断的业务类型 |
|--------|---------------|
| 博客, 文章, 内容, 发布 | blog |
| 商品, 订单, 购物车, 支付 | ecommerce |
| 运单, 物流, 配送, 快递 | logistics |
| 租户, 订阅, 套餐, SaaS | saas |
| 课程, 学员, 学习, 培训 | education |

---

## 业务模板详情

### 1. 博客 (blog)

**核心实体**
```
post (文章)
├── id, title, slug, content
├── status: draft | published | archived
├── categoryId (关联 category)
├── tags (多对多 tag)
└── createdAt, updatedAt

category (分类)
├── id, name, slug
├── parentId (自关联，支持层级)
└── order

tag (标签)
├── id, name, slug
└── postCount

comment (评论)
├── id, postId, content
├── authorName, authorEmail
├── status: pending | approved | rejected
└── parentId (支持嵌套)

media (媒体)
├── id, filename, url
├── type: image | video | document
└── size, uploadedBy
```

**管理页面**
```
/admin
├── /                    # 仪表盘：文章数、访问量、评论数
├── /posts               # 文章列表
│   ├── /new             # 新建文章 (Markdown编辑器)
│   └── /[id]            # 编辑文章
├── /categories          # 分类管理 (树形结构)
├── /tags                # 标签管理
├── /comments            # 评论审核
├── /media               # 媒体库
└── /settings            # 站点设置
```

**仪表盘指标**
- 文章总数 / 本月新增
- 总访问量 / 今日访问
- 评论数 / 待审核数
- 热门文章 TOP5

---

### 2. 电商 (ecommerce)

**核心实体**
```
product (商品)
├── id, name, slug, description
├── price, comparePrice, cost
├── sku, stock, lowStockThreshold
├── categoryId, images[]
├── status: draft | active | inactive
└── variants[] (规格)

order (订单)
├── id, orderNumber
├── customerId
├── status: pending_payment | paid | shipped | delivered | completed
├── items[], subtotal, discount, shipping, total
├── shippingAddress
└── paidAt, shippedAt, deliveredAt

customer (客户)
├── id, email, phone, name
├── addresses[]
├── orderCount, totalSpent
└── tags[]

coupon (优惠券)
├── id, code, name
├── type: percentage | fixed
├── value, minPurchase, maxDiscount
├── usageLimit, usedCount
└── startDate, endDate, status
```

**管理页面**
```
/admin
├── /                    # 仪表盘：今日订单、收入、待处理
├── /orders              # 订单列表
│   └── /[id]            # 订单详情（发货、退款）
├── /products            # 商品列表
│   ├── /new             # 新建商品
│   └── /[id]            # 编辑商品
├── /customers           # 客户管理
│   └── /[id]            # 客户详情
├── /categories          # 商品分类
├── /coupons             # 优惠券
├── /inventory           # 库存管理
└── /reports             # 销售报表
```

**仪表盘指标**
- 今日订单数 / 今日收入
- 待发货订单 / 待处理退款
- 本月 GMV / 客单价
- 库存预警商品数

---

### 3. 物流 (logistics)

**核心实体**
```
shipment (运单)
├── id, waybillNumber
├── status: created | picked | in_transit | delivered | exception
├── sender, receiver (ContactInfo)
├── weight, pieces, serviceType
├── estimatedDelivery, actualDelivery
└── currentStationId, driverId

track (轨迹)
├── id, shipmentId
├── stationId, operatorId
├── action: pickup | arrival | departure | delivery | signed
└── description, location, photo, createdAt

station (网点)
├── id, code, name
├── type: hub | branch | pickup_point
├── address, manager, phone
└── serviceArea[], location

driver (司机)
├── id, name, phone
├── vehicleId, stationId
├── status: available | on_route | off_duty
└── rating, deliveryCount, onTimeRate

exception (异常)
├── id, shipmentId
├── type: damage | lost | delay | rejection
├── description, photos[]
├── status: open | processing | resolved
└── handlerId, resolution
```

**管理页面**
```
/admin
├── /                    # 仪表盘：今日单量、在途件、异常件
├── /shipments           # 运单列表
│   └── /[id]            # 运单详情（轨迹、操作）
├── /stations            # 网点管理
├── /drivers             # 司机管理
├── /vehicles            # 车辆管理
├── /dispatch            # 调度中心（地图）
├── /exceptions          # 异常处理
└── /reports             # 运营报表
```

**仪表盘指标**
- 今日揽收量 / 派送量
- 在途件数 / 异常件数
- 时效达成率
- 网点负载分布

---

### 4. SaaS (saas)

**核心实体**
```
tenant (租户)
├── id, name, slug
├── planId, status: trial | active | suspended
├── trialEndsAt, subscriptionId
└── userCount, settings

user (用户)
├── id, tenantId, email, name
├── role: owner | admin | member
├── status: active | invited | suspended
└── lastLoginAt

plan (套餐)
├── id, name, description
├── price, billingPeriod: monthly | yearly
├── features[], limits
└── isPublic, order

subscription (订阅)
├── id, tenantId, planId
├── status: active | past_due | cancelled
├── currentPeriodStart, currentPeriodEnd
└── cancelAtPeriodEnd

invoice (账单)
├── id, tenantId, subscriptionId
├── amount, currency
├── status: draft | open | paid | void
└── periodStart, periodEnd

ticket (工单)
├── id, tenantId, userId
├── subject, description
├── priority: low | medium | high | urgent
├── status: open | pending | resolved | closed
└── assigneeId, messages[]
```

**管理页面**
```
/admin
├── /                    # 仪表盘：MRR、活跃租户、新增用户
├── /tenants             # 租户列表
│   └── /[id]            # 租户详情（用户、用量、账单）
├── /users               # 全局用户
├── /subscriptions       # 订阅管理
├── /plans               # 套餐配置
├── /billing             # 账单管理
├── /tickets             # 工单系统
└── /reports             # SaaS 指标
```

**仪表盘指标**
- MRR / ARR
- 活跃租户数 / 新增租户
- 流失率 (Churn Rate)
- 待处理工单数

---

### 5. 教育 (education)

**核心实体**
```
course (课程)
├── id, title, slug, description
├── instructorId, categoryId
├── level: beginner | intermediate | advanced
├── price, status: draft | published | archived
└── totalDuration, enrollmentCount, rating

section (章节)
├── id, courseId, title
├── order, lessonCount
└── duration

lesson (课时)
├── id, sectionId, title
├── type: video | article | quiz
├── videoUrl, duration
├── order, isFree
└── content

enrollment (报名)
├── id, courseId, studentId, orderId
├── status: active | completed | expired
├── progress, currentLessonId
└── completedLessons[], startedAt, completedAt

review (评价)
├── id, courseId, studentId
├── rating (1-5), content
├── status: pending | approved | rejected
└── createdAt
```

**管理页面**
```
/admin
├── /                    # 仪表盘：今日收入、新增学员、完课率
├── /courses             # 课程列表
│   ├── /new             # 创建课程
│   └── /[id]            # 课程详情（章节管理）
├── /students            # 学员管理
├── /orders              # 订单管理
├── /instructors         # 讲师管理
├── /reviews             # 评价管理
└── /reports             # 教学报表
```

**仪表盘指标**
- 今日收入 / 本月收入
- 新增学员 / 活跃学员
- 完课率
- 课程评分分布

---

## 通用组件映射

无论什么业务类型，以下组件都需要生成：

| 组件 | 用途 | 必需 |
|------|------|------|
| layout.tsx | 管理后台布局 | 是 |
| app-sidebar.tsx | 侧边栏导航 | 是 |
| data-table.tsx | 数据表格 | 是 |
| page-header.tsx | 页面标题 | 是 |
| status-badge.tsx | 状态徽章 | 是 |
| confirm-dialog.tsx | 确认对话框 | 是 |
| empty-state.tsx | 空状态 | 是 |
| loading-skeleton.tsx | 加载骨架 | 是 |
| theme-toggle.tsx | 主题切换 | 是 |
| mask.ts | 数据脱敏 | 是 |
| audit.ts | 审计日志 | 是 |

---

## 实体 → 页面生成规则

```javascript
// 伪代码：根据实体特征决定生成的页面

function generatePagesForEntity(entity) {
  const pages = [];

  // 基础列表页（所有实体都需要）
  pages.push({ type: "list", path: `/${entity.name}` });

  // 如果有 CRUD 操作
  if (entity.hasCreate) {
    pages.push({ type: "create", path: `/${entity.name}/new` });
  }

  // 如果有详情页需求
  if (entity.hasDetail || entity.hasUpdate) {
    pages.push({ type: "detail", path: `/${entity.name}/[id]` });
  }

  // 如果有状态字段
  if (entity.hasStatusField) {
    pages[0].features.push("status-filter");
    pages[0].features.push("status-badge");
  }

  // 如果有时间字段
  if (entity.hasTimeField) {
    pages[0].features.push("date-range-filter");
  }

  // 如果有关联实体
  if (entity.relations.length > 0) {
    pages[0].features.push("relation-expand");
  }

  return pages;
}
```
