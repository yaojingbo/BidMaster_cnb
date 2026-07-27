# Seed 数据生成模板

> 本文档定义各业务类型的测试数据生成规则，确保生成 100+ 条真实感、有关联的测试数据。

## 数据生成原则

### 1. 数据量规则

| 实体类型 | 最小数量 | 推荐数量 | 说明 |
|----------|----------|----------|------|
| 核心业务实体 | 100 | 200 | 如 post, order, shipment |
| 关联实体 | 20 | 50 | 如 category, tag |
| 配置实体 | 5 | 10 | 如 plan, role |
| 日志/记录 | 500 | 1000 | 如 audit_log, track |

### 2. 状态分布规则

```javascript
// 通用状态分布（按业务实际比例）
const statusDistribution = {
  // 博客文章
  post: {
    draft: 0.15,      // 15% 草稿
    published: 0.80,  // 80% 已发布
    archived: 0.05,   // 5% 已归档
  },
  // 电商订单
  order: {
    pending_payment: 0.05,
    paid: 0.10,
    shipped: 0.15,
    delivered: 0.60,
    completed: 0.08,
    cancelled: 0.02,
  },
  // 评论审核
  comment: {
    pending: 0.10,
    approved: 0.85,
    rejected: 0.05,
  },
  // SaaS 租户
  tenant: {
    trial: 0.20,
    active: 0.70,
    suspended: 0.05,
    churned: 0.05,
  }
};
```

### 3. 时间分布规则

```javascript
// 时间分布：模拟真实业务增长曲线
const timeDistribution = {
  // 过去 365 天，早期少，近期多
  strategy: "exponential_growth",
  config: {
    startDate: "365d_ago",
    endDate: "now",
    growthRate: 1.5,  // 每月增长 50%
  }
};

// 生成函数
function generateCreatedAt(index, total) {
  const daysAgo = Math.floor(365 * Math.pow(1 - index/total, 2));
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}
```

### 4. 关联数据规则

```javascript
// 确保外键引用有效
const relationRules = {
  // 一对多
  "post.categoryId": {
    strategy: "random_from_pool",
    pool: "categories",
    distribution: "weighted", // 热门分类权重更高
  },
  // 多对多
  "post.tags": {
    strategy: "random_subset",
    pool: "tags",
    minCount: 1,
    maxCount: 5,
  },
  // 自关联
  "comment.parentId": {
    strategy: "null_or_existing",
    nullProbability: 0.7, // 70% 是顶级评论
    pool: "comments",
  }
};
```

---

## 业务模板数据

### 1. 博客 (blog)

```typescript
// src/admin/scripts/seed/blog.seed.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const blogSeedConfig = {
  // 分类（先生成，作为外键池）
  categories: {
    count: 15,
    generator: () => ({
      id: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        '技术', '生活', '读书', '旅行', '美食',
        '摄影', '音乐', '电影', '游戏', '设计',
        'AI', '编程', '产品', '创业', '职场'
      ]),
      slug: faker.helpers.slugify(faker.lorem.word()),
      parentId: null, // 简单起见，不生成层级
      order: faker.number.int({ min: 1, max: 100 }),
      createdAt: faker.date.past({ years: 2 }),
    }),
  },

  // 标签
  tags: {
    count: 50,
    generator: () => ({
      id: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        'JavaScript', 'TypeScript', 'React', 'Vue', 'Next.js',
        'Node.js', 'Python', 'AI', 'GPT', 'Claude',
        '效率', '工具', '开源', '教程', '经验',
        '2024', '入门', '进阶', '实战', '源码',
      ]),
      slug: faker.helpers.slugify(faker.lorem.word()),
      postCount: 0, // 后续更新
    }),
  },

  // 文章（核心实体，100+ 条）
  posts: {
    count: 150,
    generator: (index, pools) => {
      const status = weightedRandom({
        draft: 0.15,
        published: 0.80,
        archived: 0.05,
      });
      return {
        id: faker.string.uuid(),
        title: faker.lorem.sentence({ min: 5, max: 15 }),
        slug: faker.helpers.slugify(faker.lorem.words(3)),
        content: faker.lorem.paragraphs({ min: 5, max: 20 }),
        excerpt: faker.lorem.paragraph(),
        status,
        categoryId: faker.helpers.arrayElement(pools.categories).id,
        viewCount: faker.number.int({ min: 0, max: 10000 }),
        likeCount: faker.number.int({ min: 0, max: 500 }),
        createdAt: generateCreatedAt(index, 150),
        updatedAt: faker.date.recent(),
        publishedAt: status === 'published' ? faker.date.past() : null,
      };
    },
    relations: {
      tags: { minCount: 1, maxCount: 5 },
    },
  },

  // 评论
  comments: {
    count: 300,
    generator: (index, pools) => {
      const parentComment = index > 50 && Math.random() > 0.7
        ? faker.helpers.arrayElement(pools.comments.slice(0, index))
        : null;
      return {
        id: faker.string.uuid(),
        postId: faker.helpers.arrayElement(pools.posts.filter(p => p.status === 'published')).id,
        content: faker.lorem.paragraph(),
        authorName: faker.person.fullName(),
        authorEmail: faker.internet.email(),
        authorAvatar: faker.image.avatar(),
        status: weightedRandom({
          pending: 0.10,
          approved: 0.85,
          rejected: 0.05,
        }),
        parentId: parentComment?.id || null,
        likeCount: faker.number.int({ min: 0, max: 50 }),
        createdAt: generateCreatedAt(index, 300),
      };
    },
  },

  // 媒体文件
  media: {
    count: 100,
    generator: () => ({
      id: faker.string.uuid(),
      filename: faker.system.fileName(),
      url: faker.image.url(),
      type: faker.helpers.arrayElement(['image', 'video', 'document']),
      size: faker.number.int({ min: 1024, max: 10485760 }),
      mimeType: faker.system.mimeType(),
      uploadedBy: 'admin',
      createdAt: faker.date.past(),
    }),
  },
};
```

### 2. 电商 (ecommerce)

```typescript
// src/admin/scripts/seed/ecommerce.seed.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const ecommerceSeedConfig = {
  // 商品分类
  categories: {
    count: 20,
    generator: () => ({
      id: faker.string.uuid(),
      name: faker.commerce.department(),
      slug: faker.helpers.slugify(faker.commerce.department()),
      image: faker.image.url(),
      order: faker.number.int({ min: 1, max: 100 }),
    }),
  },

  // 商品（100+ 条）
  products: {
    count: 200,
    generator: (index, pools) => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      slug: faker.helpers.slugify(faker.commerce.productName()),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price({ min: 10, max: 5000 })),
      comparePrice: parseFloat(faker.commerce.price({ min: 10, max: 6000 })),
      cost: parseFloat(faker.commerce.price({ min: 5, max: 2000 })),
      sku: faker.string.alphanumeric(8).toUpperCase(),
      stock: faker.number.int({ min: 0, max: 1000 }),
      lowStockThreshold: 10,
      categoryId: faker.helpers.arrayElement(pools.categories).id,
      images: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.image.url()),
      status: weightedRandom({
        draft: 0.10,
        active: 0.80,
        inactive: 0.10,
      }),
      salesCount: faker.number.int({ min: 0, max: 5000 }),
      rating: faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 }),
      reviewCount: faker.number.int({ min: 0, max: 200 }),
      createdAt: generateCreatedAt(index, 200),
    }),
  },

  // 客户
  customers: {
    count: 100,
    generator: () => ({
      id: faker.string.uuid(),
      email: faker.internet.email(),
      phone: faker.phone.number('1##########'),
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
      addresses: [
        {
          province: faker.location.state(),
          city: faker.location.city(),
          district: faker.location.county(),
          street: faker.location.streetAddress(),
          zipcode: faker.location.zipCode(),
          isDefault: true,
        }
      ],
      orderCount: 0, // 后续更新
      totalSpent: 0, // 后续更新
      tags: faker.helpers.arrayElements(['VIP', '新客', '老客', '高价值', '流失风险'], { min: 0, max: 2 }),
      createdAt: faker.date.past({ years: 2 }),
      lastOrderAt: faker.date.recent(),
    }),
  },

  // 订单（核心实体，100+ 条）
  orders: {
    count: 500,
    generator: (index, pools) => {
      const customer = faker.helpers.arrayElement(pools.customers);
      const status = weightedRandom({
        pending_payment: 0.05,
        paid: 0.10,
        shipped: 0.15,
        delivered: 0.60,
        completed: 0.08,
        cancelled: 0.02,
      });
      const items = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const product = faker.helpers.arrayElement(pools.products);
          const quantity = faker.number.int({ min: 1, max: 3 });
          return {
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity,
            subtotal: product.price * quantity,
          };
        }
      );
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const discount = Math.random() > 0.7 ? faker.number.float({ min: 5, max: 50 }) : 0;
      const shipping = subtotal > 99 ? 0 : 10;

      return {
        id: faker.string.uuid(),
        orderNumber: `ORD${faker.string.numeric(12)}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        status,
        items,
        subtotal,
        discount,
        shipping,
        total: subtotal - discount + shipping,
        shippingAddress: customer.addresses[0],
        paymentMethod: faker.helpers.arrayElement(['alipay', 'wechat', 'card']),
        note: Math.random() > 0.8 ? faker.lorem.sentence() : null,
        paidAt: ['paid', 'shipped', 'delivered', 'completed'].includes(status) ? faker.date.past() : null,
        shippedAt: ['shipped', 'delivered', 'completed'].includes(status) ? faker.date.past() : null,
        deliveredAt: ['delivered', 'completed'].includes(status) ? faker.date.recent() : null,
        createdAt: generateCreatedAt(index, 500),
      };
    },
  },

  // 优惠券
  coupons: {
    count: 30,
    generator: () => {
      const type = faker.helpers.arrayElement(['percentage', 'fixed']);
      return {
        id: faker.string.uuid(),
        code: faker.string.alphanumeric(8).toUpperCase(),
        name: faker.commerce.productAdjective() + '优惠券',
        type,
        value: type === 'percentage'
          ? faker.number.int({ min: 5, max: 30 })
          : faker.number.int({ min: 10, max: 100 }),
        minPurchase: faker.number.int({ min: 0, max: 200 }),
        maxDiscount: type === 'percentage' ? faker.number.int({ min: 20, max: 100 }) : null,
        usageLimit: faker.number.int({ min: 100, max: 10000 }),
        usedCount: faker.number.int({ min: 0, max: 500 }),
        startDate: faker.date.past(),
        endDate: faker.date.future(),
        status: weightedRandom({ active: 0.6, inactive: 0.2, expired: 0.2 }),
        createdAt: faker.date.past(),
      };
    },
  },
};
```

### 3. SaaS (saas)

```typescript
// src/admin/scripts/seed/saas.seed.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const saasSeedConfig = {
  // 套餐
  plans: {
    count: 4,
    generator: (index) => {
      const plans = [
        { name: '免费版', price: 0, features: ['基础功能', '5个用户', '1GB存储'] },
        { name: '专业版', price: 99, features: ['高级功能', '20个用户', '10GB存储', '优先支持'] },
        { name: '企业版', price: 299, features: ['全部功能', '无限用户', '100GB存储', '专属客服', 'API访问'] },
        { name: '旗舰版', price: 999, features: ['定制功能', '无限一切', '私有部署', '专属顾问'] },
      ];
      return {
        id: faker.string.uuid(),
        ...plans[index],
        billingPeriod: 'monthly',
        isPublic: true,
        order: index + 1,
        createdAt: faker.date.past({ years: 2 }),
      };
    },
  },

  // 租户（100+ 条）
  tenants: {
    count: 150,
    generator: (index, pools) => ({
      id: faker.string.uuid(),
      name: faker.company.name(),
      slug: faker.helpers.slugify(faker.company.name()),
      planId: faker.helpers.arrayElement(pools.plans).id,
      status: weightedRandom({
        trial: 0.20,
        active: 0.70,
        suspended: 0.05,
        churned: 0.05,
      }),
      trialEndsAt: faker.date.soon({ days: 14 }),
      userCount: faker.number.int({ min: 1, max: 50 }),
      storageUsed: faker.number.int({ min: 100, max: 10000 }) * 1024 * 1024,
      settings: {
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
      },
      createdAt: generateCreatedAt(index, 150),
    }),
  },

  // 用户
  users: {
    count: 500,
    generator: (index, pools) => {
      const tenant = faker.helpers.arrayElement(pools.tenants);
      return {
        id: faker.string.uuid(),
        tenantId: tenant.id,
        email: faker.internet.email(),
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
        role: weightedRandom({
          owner: 0.05,
          admin: 0.15,
          member: 0.80,
        }),
        status: weightedRandom({
          active: 0.85,
          invited: 0.10,
          suspended: 0.05,
        }),
        lastLoginAt: faker.date.recent(),
        createdAt: generateCreatedAt(index, 500),
      };
    },
  },

  // 订阅
  subscriptions: {
    count: 120,
    generator: (index, pools) => {
      const tenant = pools.tenants[index % pools.tenants.length];
      const plan = faker.helpers.arrayElement(pools.plans);
      return {
        id: faker.string.uuid(),
        tenantId: tenant.id,
        planId: plan.id,
        status: weightedRandom({
          active: 0.80,
          past_due: 0.10,
          cancelled: 0.10,
        }),
        currentPeriodStart: faker.date.recent(),
        currentPeriodEnd: faker.date.soon({ days: 30 }),
        cancelAtPeriodEnd: Math.random() > 0.9,
        createdAt: generateCreatedAt(index, 120),
      };
    },
  },

  // 工单
  tickets: {
    count: 200,
    generator: (index, pools) => {
      const tenant = faker.helpers.arrayElement(pools.tenants);
      const user = pools.users.find(u => u.tenantId === tenant.id) || faker.helpers.arrayElement(pools.users);
      return {
        id: faker.string.uuid(),
        tenantId: tenant.id,
        userId: user.id,
        subject: faker.lorem.sentence({ min: 5, max: 10 }),
        description: faker.lorem.paragraphs(2),
        priority: weightedRandom({
          low: 0.30,
          medium: 0.50,
          high: 0.15,
          urgent: 0.05,
        }),
        status: weightedRandom({
          open: 0.20,
          pending: 0.30,
          resolved: 0.40,
          closed: 0.10,
        }),
        assigneeId: Math.random() > 0.3 ? 'admin-001' : null,
        messages: Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () => ({
          id: faker.string.uuid(),
          content: faker.lorem.paragraph(),
          authorType: faker.helpers.arrayElement(['user', 'support']),
          createdAt: faker.date.recent(),
        })),
        createdAt: generateCreatedAt(index, 200),
        resolvedAt: Math.random() > 0.5 ? faker.date.recent() : null,
      };
    },
  },
};
```

---

## 工具函数

```typescript
// src/admin/scripts/seed/utils.ts

/**
 * 按权重随机选择
 */
export function weightedRandom<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * total;

  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/**
 * 生成渐进式时间（模拟业务增长）
 */
export function generateCreatedAt(index: number, total: number): Date {
  const daysAgo = Math.floor(365 * Math.pow(1 - index / total, 2));
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

/**
 * 生成关联数据
 */
export function generateRelations<T>(
  pool: T[],
  config: { minCount: number; maxCount: number }
): T[] {
  const count = faker.number.int({ min: config.minCount, max: config.maxCount });
  return faker.helpers.arrayElements(pool, count);
}

/**
 * 中文手机号生成
 */
export function generateChinesePhone(): string {
  const prefixes = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139',
                    '150', '151', '152', '153', '155', '156', '157', '158', '159',
                    '180', '181', '182', '183', '184', '185', '186', '187', '188', '189'];
  const prefix = faker.helpers.arrayElement(prefixes);
  const suffix = faker.string.numeric(8);
  return prefix + suffix;
}

/**
 * 中文地址生成
 */
export function generateChineseAddress(): object {
  const provinces = ['北京市', '上海市', '广东省', '浙江省', '江苏省', '四川省'];
  const cities = {
    '北京市': ['北京市'],
    '上海市': ['上海市'],
    '广东省': ['广州市', '深圳市', '东莞市'],
    '浙江省': ['杭州市', '宁波市', '温州市'],
    '江苏省': ['南京市', '苏州市', '无锡市'],
    '四川省': ['成都市', '绵阳市', '德阳市'],
  };

  const province = faker.helpers.arrayElement(provinces);
  const city = faker.helpers.arrayElement(cities[province]);

  return {
    province,
    city,
    district: faker.location.county(),
    street: faker.location.streetAddress(),
    zipcode: faker.location.zipCode('######'),
  };
}
```

---

## Seed 执行脚本模板

```typescript
// src/admin/scripts/seed/index.ts
import { db } from '@/admin/lib/db';
import { blogSeedConfig } from './blog.seed';
import { ecommerceSeedConfig } from './ecommerce.seed';
import { saasSeedConfig } from './saas.seed';

const seedConfigs = {
  blog: blogSeedConfig,
  ecommerce: ecommerceSeedConfig,
  saas: saasSeedConfig,
};

async function seed(businessType: keyof typeof seedConfigs) {
  const config = seedConfigs[businessType];
  const pools: Record<string, any[]> = {};

  console.log(`Seeding ${businessType} data...`);

  for (const [entityName, entityConfig] of Object.entries(config)) {
    console.log(`  Generating ${entityConfig.count} ${entityName}...`);

    const data = [];
    for (let i = 0; i < entityConfig.count; i++) {
      const item = entityConfig.generator(i, pools);
      data.push(item);
    }

    pools[entityName] = data;

    // 批量插入数据库
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await db.insert(entityName).values(batch);
    }

    console.log(`  ✓ ${entityName}: ${data.length} records`);
  }

  console.log(`\nSeeding complete!`);
}

// 执行
const businessType = process.argv[2] || 'blog';
seed(businessType as keyof typeof seedConfigs);
```

---

### 4. 技能平台 (skill-platform) [v3.3 NEW]

```typescript
// src/admin/scripts/seed/skill-platform.seed.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const skillPlatformSeedConfig = {
  // 技能分类
  categories: {
    count: 10,
    generator: () => ({
      id: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        '内容创作', '数据分析', '代码开发', '产品管理', '设计创意',
        '市场营销', '客户服务', '财务管理', '人力资源', '项目管理'
      ]),
      description: faker.lorem.sentence(),
      order: faker.number.int({ min: 1, max: 100 }),
      skillCount: 0, // 后续更新
      createdAt: faker.date.past({ years: 1 }),
    }),
  },

  // 用户（100+ 条）
  users: {
    count: 120,
    generator: (index) => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: Math.random() > 0.2,
      image: faker.image.avatar(),
      role: weightedRandom({ user: 0.90, admin: 0.10 }),
      createdAt: generateCreatedAt(index, 120),
      updatedAt: faker.date.recent(),
    }),
  },

  // 管理员
  adminUsers: {
    count: 15,
    generator: (index) => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: true,
      image: faker.image.avatar(),
      role: weightedRandom({ admin: 0.80, super_admin: 0.20 }),
      createdAt: generateCreatedAt(index, 15),
      updatedAt: faker.date.recent(),
    }),
  },

  // 技能（核心实体，100+ 条）
  skills: {
    count: 140,
    generator: (index, pools) => {
      const status = weightedRandom({
        draft: 0.10,
        published: 0.80,
        archived: 0.10,
      });
      return {
        id: faker.string.uuid(),
        name: faker.lorem.words({ min: 2, max: 5 }),
        description: faker.lorem.paragraph(),
        content: faker.lorem.paragraphs({ min: 3, max: 10 }),
        categoryId: faker.helpers.arrayElement(pools.categories).id,
        authorId: faker.helpers.arrayElement(pools.users).id,
        status,
        usageCount: faker.number.int({ min: 0, max: 5000 }),
        rating: faker.number.float({ min: 3.0, max: 5.0, fractionDigits: 1 }),
        reviewCount: faker.number.int({ min: 0, max: 200 }),
        version: `${faker.number.int({ min: 1, max: 3 })}.${faker.number.int({ min: 0, max: 9 })}.0`,
        createdAt: generateCreatedAt(index, 140),
        updatedAt: faker.date.recent(),
        publishedAt: status === 'published' ? faker.date.past() : null,
      };
    },
  },

  // 审计日志（500+ 条）
  auditLogs: {
    count: 550,
    generator: (index, pools) => {
      const allUsers = [...pools.users, ...pools.adminUsers];
      const actor = faker.helpers.arrayElement(allUsers);
      return {
        id: faker.string.uuid(),
        userId: actor.id,
        action: faker.helpers.arrayElement([
          'user.create', 'user.update', 'user.delete', 'user.login',
          'skill.create', 'skill.update', 'skill.delete', 'skill.publish',
          'category.create', 'category.update',
          'settings.update', 'admin.login'
        ]),
        entityType: faker.helpers.arrayElement(['user', 'skill', 'category', 'settings']),
        entityId: faker.string.uuid(),
        oldValues: Math.random() > 0.5 ? { status: 'draft' } : null,
        newValues: Math.random() > 0.5 ? { status: 'published' } : null,
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        createdAt: generateCreatedAt(index, 550),
      };
    },
  },
};
```

---

## BI 报表数据生成 [v3.3 NEW]

> 以下模板用于为决策驾驶舱生成 120 天的测试数据。

### 5. BI 数据结构

```typescript
// src/admin/scripts/seed/bi-reports.seed.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const biReportsSeedConfig = {
  // 订阅计划
  subscriptionPlans: {
    count: 5,
    generator: (index) => {
      const plans = [
        { name: 'Free', nameZh: '免费版', price: 0, interval: 'monthly' },
        { name: 'Basic', nameZh: '基础版', price: 900, interval: 'monthly' },
        { name: 'Pro', nameZh: '专业版', price: 2900, interval: 'monthly' },
        { name: 'Team', nameZh: '团队版', price: 9900, interval: 'monthly' },
        { name: 'Enterprise', nameZh: '企业版', price: 29900, interval: 'monthly' },
      ];
      const plan = plans[index] || plans[0];
      return {
        id: `plan_${plan.name.toLowerCase()}`,
        name: plan.name,
        nameZh: plan.nameZh,
        price: plan.price, // 单位：分
        interval: plan.interval,
        features: faker.lorem.words({ min: 3, max: 6 }).split(' '),
        isActive: true,
        order: index + 1,
        createdAt: faker.date.past({ years: 2 }),
      };
    },
  },

  // 用户订阅
  userSubscriptions: {
    count: 90, // 约 70% 用户有订阅
    generator: (index, pools) => {
      const user = pools.users[index % pools.users.length];
      const plan = faker.helpers.arrayElement(pools.subscriptionPlans);
      const status = weightedRandom({
        trial: 0.15,
        active: 0.65,
        expired: 0.12,
        cancelled: 0.08,
      });
      const startDate = faker.date.past({ years: 1 });
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      return {
        id: faker.string.uuid(),
        userId: user.id,
        planId: plan.id,
        status,
        startDate,
        endDate,
        cancelledAt: status === 'cancelled' ? faker.date.recent() : null,
        cancelReason: status === 'cancelled'
          ? faker.helpers.arrayElement(['价格太高', '功能不够', '不再需要', '换用其他产品'])
          : null,
        createdAt: startDate,
      };
    },
  },

  // 用户事件
  userEvents: {
    count: 600, // 每用户约 5-10 个事件
    generator: (index, pools) => {
      const user = faker.helpers.arrayElement(pools.users);
      const eventType = weightedRandom({
        visit: 0.35,
        signup: 0.12,
        activate: 0.10,
        subscribe: 0.08,
        renew: 0.10,
        refer: 0.05,
        churn: 0.05,
        upgrade: 0.08,
        downgrade: 0.07,
      });

      return {
        id: faker.string.uuid(),
        userId: user.id,
        eventType,
        eventValue: ['subscribe', 'renew', 'upgrade'].includes(eventType)
          ? faker.number.int({ min: 900, max: 29900 })
          : null,
        metadata: {
          browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox', 'Edge']),
          device: faker.helpers.arrayElement(['desktop', 'mobile', 'tablet']),
        },
        source: faker.helpers.arrayElement(['organic', 'referral', 'paid_ads', 'social', 'direct']),
        createdAt: faker.date.past({ days: 120 }),
      };
    },
  },

  // 每日指标（120 天）
  dailyMetrics: {
    count: 120,
    generator: (index) => {
      const date = new Date();
      date.setDate(date.getDate() - (120 - index));
      const dateStr = date.toISOString().split('T')[0];

      // 模拟业务增长
      const dayProgress = index / 120;
      const growthFactor = 1 + dayProgress * 0.5; // 50% 增长
      const randomVariance = 0.8 + Math.random() * 0.4; // ±20% 波动

      const visitors = Math.floor(300 * growthFactor * randomVariance);
      const signups = Math.floor(visitors * (0.15 + Math.random() * 0.10)); // 15-25%
      const activations = Math.floor(signups * (0.50 + Math.random() * 0.20)); // 50-70%
      const conversions = Math.floor(activations * (0.15 + Math.random() * 0.10)); // 15-25%

      const revenue = conversions * faker.number.int({ min: 900, max: 9900 });
      const orders = conversions;
      const avgOrderValue = orders > 0 ? Math.floor(revenue / orders) : 0;

      const activeUsers = Math.floor(150 * growthFactor * randomVariance);
      const churnedUsers = Math.floor(activeUsers * (0.02 + Math.random() * 0.03)); // 2-5%
      const renewals = Math.floor(activeUsers * (0.05 + Math.random() * 0.05)); // 5-10%

      const referrals = Math.floor(activeUsers * (0.02 + Math.random() * 0.02)); // 2-4%
      const referralConversions = Math.floor(referrals * (0.20 + Math.random() * 0.20)); // 20-40%

      const apiCalls = Math.floor(3000 * growthFactor * randomVariance);
      const apiCost = Math.floor(apiCalls * 0.01); // ¥0.0001/调用
      const infrastructureCost = faker.number.int({ min: 800, max: 1500 }); // 日均 ¥8-15

      return {
        id: faker.string.uuid(),
        date: dateStr,
        newUsers: signups,
        activeUsers,
        totalUsers: Math.floor(400 * growthFactor),
        visitors,
        signups,
        activations,
        conversions,
        revenue,
        orders,
        avgOrderValue,
        churnedUsers,
        renewals,
        referrals,
        referralConversions,
        apiCalls,
        apiCost,
        infrastructureCost,
        createdAt: date,
      };
    },
  },
};
```

### 6. BI 指标计算规则

```typescript
const biMetricsRules = {
  // 转化漏斗 (R1: 增付费转化)
  conversion: {
    visitorToSignup: { base: 0.20, variance: 0.05 },    // 15-25%
    signupToActivation: { base: 0.60, variance: 0.10 }, // 50-70%
    activationToPayment: { base: 0.20, variance: 0.05 }, // 15-25%
  },

  // 营收指标 (R2: 增客单价)
  revenue: {
    planDistribution: {
      free: 0.40,    // 40% 免费用户
      basic: 0.35,   // 35% 基础版
      pro: 0.15,     // 15% 专业版
      team: 0.08,    // 8% 团队版
      enterprise: 0.02, // 2% 企业版
    },
    avgOrderValueRange: { min: 900, max: 9900 }, // ¥9-99
  },

  // 留存指标 (R3: 增复购率)
  retention: {
    churnRate: { base: 0.03, variance: 0.02 },     // 2-5% 月流失率
    renewalRate: { base: 0.85, variance: 0.10 },   // 75-95% 续费率
    atRiskDays: 7, // 到期前 7 天为高风险
  },

  // 推荐指标 (R4: 增推荐率)
  referral: {
    referralRate: { base: 0.03, variance: 0.02 }, // 2-5% 推荐率
    referralConversion: { base: 0.30, variance: 0.10 }, // 20-40% 转化率
    kFactor: { base: 0.15, variance: 0.05 }, // 病毒系数
  },

  // 成本指标 (C1-C4: 降本四策)
  costs: {
    apiCostPerCall: 0.0001,        // ¥0.0001/次
    infrastructureBase: 1000,      // ¥10/天 基础设施
    infrastructureGrowth: 0.01,    // 1% 日增长
    targetGrossMargin: 0.85,       // 目标毛利率 85%
  },

  // 增长模式
  growth: {
    pattern: 'exponential',
    dailyGrowthRate: 0.005,  // 0.5% 日复合增长
    variance: 0.20,          // ±20% 随机波动
    seasonalFactor: false,   // 是否考虑季节性
  },
};
```

---

## 验证清单

生成数据后，验证以下内容：

### 基础数据验证
- [ ] 每个核心实体 >= 100 条数据
- [ ] 外键关联全部有效
- [ ] 状态分布符合预期比例
- [ ] 时间分布呈增长趋势
- [ ] 无空值/异常值导致的运行时错误

### UI/UX 验证
- [ ] 列表页加载性能正常（< 500ms）
- [ ] 分页功能正常
- [ ] 筛选功能正常
- [ ] 搜索功能正常

### BI 报表验证 [v3.3 NEW]
- [ ] 每日指标连续 120 天无缺失
- [ ] 转化漏斗数据逻辑正确（每层 <= 上层）
- [ ] 营收趋势呈增长态势
- [ ] 流失率在合理范围内（< 10%）
- [ ] 成本数据与 API 调用量成正比
- [ ] 毛利率计算正确
