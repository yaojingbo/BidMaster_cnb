#!/usr/bin/env bun
/**
 * Seed Generator Script
 *
 * 为 admin-business 生成的管理后台填充测试数据
 *
 * Usage:
 *   bun run scripts/seed-generator.ts [business-type] [--count=100]
 *
 * Examples:
 *   bun run scripts/seed-generator.ts blog
 *   bun run scripts/seed-generator.ts ecommerce --count=200
 *   bun run scripts/seed-generator.ts saas --count=150
 */

import { faker } from "@faker-js/faker/locale/zh_CN";

// ==================== 工具函数 ====================

/**
 * 按权重随机选择
 */
function weightedRandom<T extends string>(weights: Record<T, number>): T {
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
function generateCreatedAt(index: number, total: number): Date {
  const daysAgo = Math.floor(365 * Math.pow(1 - index / total, 2));
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

/**
 * 中文手机号生成
 */
function generateChinesePhone(): string {
  const prefixes = [
    "130",
    "131",
    "132",
    "133",
    "134",
    "135",
    "136",
    "137",
    "138",
    "139",
    "150",
    "151",
    "152",
    "153",
    "155",
    "156",
    "157",
    "158",
    "159",
    "180",
    "181",
    "182",
    "183",
    "184",
    "185",
    "186",
    "187",
    "188",
    "189",
  ];
  const prefix = faker.helpers.arrayElement(prefixes);
  const suffix = faker.string.numeric(8);
  return prefix + suffix;
}

/**
 * 中文地址生成
 */
function generateChineseAddress() {
  const provinces = ["北京市", "上海市", "广东省", "浙江省", "江苏省", "四川省"];
  const cities: Record<string, string[]> = {
    北京市: ["北京市"],
    上海市: ["上海市"],
    广东省: ["广州市", "深圳市", "东莞市", "佛山市"],
    浙江省: ["杭州市", "宁波市", "温州市", "嘉兴市"],
    江苏省: ["南京市", "苏州市", "无锡市", "常州市"],
    四川省: ["成都市", "绵阳市", "德阳市", "宜宾市"],
  };

  const province = faker.helpers.arrayElement(provinces);
  const city = faker.helpers.arrayElement(cities[province]);

  return {
    province,
    city,
    district: faker.location.county(),
    street: faker.location.streetAddress(),
    zipcode: faker.location.zipCode("######"),
  };
}

// ==================== 业务数据生成器 ====================

interface SeedConfig {
  count: number;
  generator: (index: number, pools: Record<string, any[]>) => any;
}

// ---------- 博客业务 ----------
function getBlogSeedConfig(baseCount: number): Record<string, SeedConfig> {
  return {
    categories: {
      count: 15,
      generator: () => ({
        id: faker.string.uuid(),
        name: faker.helpers.arrayElement([
          "技术",
          "生活",
          "读书",
          "旅行",
          "美食",
          "摄影",
          "音乐",
          "电影",
          "游戏",
          "设计",
          "AI",
          "编程",
          "产品",
          "创业",
          "职场",
        ]),
        slug: faker.helpers.slugify(faker.lorem.word()),
        parentId: null,
        order: faker.number.int({ min: 1, max: 100 }),
        createdAt: faker.date.past({ years: 2 }),
      }),
    },

    tags: {
      count: 50,
      generator: () => ({
        id: faker.string.uuid(),
        name: faker.helpers.arrayElement([
          "JavaScript",
          "TypeScript",
          "React",
          "Vue",
          "Next.js",
          "Node.js",
          "Python",
          "AI",
          "GPT",
          "Claude",
          "效率",
          "工具",
          "开源",
          "教程",
          "经验",
          "2024",
          "入门",
          "进阶",
          "实战",
          "源码",
          "Rust",
          "Go",
          "Docker",
          "K8s",
          "前端",
          "后端",
          "全栈",
          "架构",
          "性能",
          "安全",
        ]),
        slug: faker.helpers.slugify(faker.lorem.word()),
        postCount: 0,
      }),
    },

    posts: {
      count: Math.max(baseCount, 100),
      generator: (index, pools) => {
        const status = weightedRandom({
          draft: 0.15,
          published: 0.8,
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
          tagIds: faker.helpers
            .arrayElements(pools.tags, { min: 1, max: 5 })
            .map((t: any) => t.id),
          viewCount: faker.number.int({ min: 0, max: 10000 }),
          likeCount: faker.number.int({ min: 0, max: 500 }),
          createdAt: generateCreatedAt(index, baseCount),
          updatedAt: faker.date.recent(),
          publishedAt: status === "published" ? faker.date.past() : null,
        };
      },
    },

    comments: {
      count: Math.floor(baseCount * 2),
      generator: (index, pools) => {
        const publishedPosts = pools.posts.filter(
          (p: any) => p.status === "published"
        );
        const parentComment =
          index > 50 && Math.random() > 0.7
            ? faker.helpers.arrayElement(
                pools.comments?.slice(0, index) || [null]
              )
            : null;
        return {
          id: faker.string.uuid(),
          postId: faker.helpers.arrayElement(publishedPosts).id,
          content: faker.lorem.paragraph(),
          authorName: faker.person.fullName(),
          authorEmail: faker.internet.email(),
          authorAvatar: faker.image.avatar(),
          status: weightedRandom({
            pending: 0.1,
            approved: 0.85,
            rejected: 0.05,
          }),
          parentId: parentComment?.id || null,
          likeCount: faker.number.int({ min: 0, max: 50 }),
          createdAt: generateCreatedAt(index, baseCount * 2),
        };
      },
    },

    media: {
      count: Math.floor(baseCount * 0.5),
      generator: () => ({
        id: faker.string.uuid(),
        filename: faker.system.fileName(),
        url: faker.image.url(),
        type: faker.helpers.arrayElement(["image", "video", "document"]),
        size: faker.number.int({ min: 1024, max: 10485760 }),
        mimeType: faker.system.mimeType(),
        uploadedBy: "admin",
        createdAt: faker.date.past(),
      }),
    },
  };
}

// ---------- 电商业务 ----------
function getEcommerceSeedConfig(baseCount: number): Record<string, SeedConfig> {
  return {
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

    products: {
      count: Math.max(baseCount, 100),
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
        images: Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => faker.image.url()
        ),
        status: weightedRandom({
          draft: 0.1,
          active: 0.8,
          inactive: 0.1,
        }),
        salesCount: faker.number.int({ min: 0, max: 5000 }),
        rating: faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 }),
        reviewCount: faker.number.int({ min: 0, max: 200 }),
        createdAt: generateCreatedAt(index, baseCount),
      }),
    },

    customers: {
      count: Math.floor(baseCount * 0.5),
      generator: () => ({
        id: faker.string.uuid(),
        email: faker.internet.email(),
        phone: generateChinesePhone(),
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
        addresses: [{ ...generateChineseAddress(), isDefault: true }],
        orderCount: 0,
        totalSpent: 0,
        tags: faker.helpers.arrayElements(
          ["VIP", "新客", "老客", "高价值", "流失风险"],
          { min: 0, max: 2 }
        ),
        createdAt: faker.date.past({ years: 2 }),
        lastOrderAt: faker.date.recent(),
      }),
    },

    orders: {
      count: Math.floor(baseCount * 2.5),
      generator: (index, pools) => {
        const customer = faker.helpers.arrayElement(pools.customers);
        const status = weightedRandom({
          pending_payment: 0.05,
          paid: 0.1,
          shipped: 0.15,
          delivered: 0.6,
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
        const discount =
          Math.random() > 0.7
            ? faker.number.float({ min: 5, max: 50, fractionDigits: 2 })
            : 0;
        const shipping = subtotal > 99 ? 0 : 10;

        return {
          id: faker.string.uuid(),
          orderNumber: `ORD${faker.string.numeric(12)}`,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          status,
          items,
          subtotal: Math.round(subtotal * 100) / 100,
          discount,
          shipping,
          total: Math.round((subtotal - discount + shipping) * 100) / 100,
          shippingAddress: customer.addresses[0],
          paymentMethod: faker.helpers.arrayElement([
            "alipay",
            "wechat",
            "card",
          ]),
          note: Math.random() > 0.8 ? faker.lorem.sentence() : null,
          paidAt: ["paid", "shipped", "delivered", "completed"].includes(status)
            ? faker.date.past()
            : null,
          shippedAt: ["shipped", "delivered", "completed"].includes(status)
            ? faker.date.past()
            : null,
          deliveredAt: ["delivered", "completed"].includes(status)
            ? faker.date.recent()
            : null,
          createdAt: generateCreatedAt(index, baseCount * 2.5),
        };
      },
    },

    coupons: {
      count: 30,
      generator: () => {
        const type = faker.helpers.arrayElement([
          "percentage",
          "fixed",
        ] as const);
        return {
          id: faker.string.uuid(),
          code: faker.string.alphanumeric(8).toUpperCase(),
          name: faker.commerce.productAdjective() + "优惠券",
          type,
          value:
            type === "percentage"
              ? faker.number.int({ min: 5, max: 30 })
              : faker.number.int({ min: 10, max: 100 }),
          minPurchase: faker.number.int({ min: 0, max: 200 }),
          maxDiscount:
            type === "percentage"
              ? faker.number.int({ min: 20, max: 100 })
              : null,
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
}

// ---------- SaaS 业务 ----------
function getSaasSeedConfig(baseCount: number): Record<string, SeedConfig> {
  return {
    plans: {
      count: 4,
      generator: (index) => {
        const plans = [
          {
            name: "免费版",
            price: 0,
            features: ["基础功能", "5个用户", "1GB存储"],
          },
          {
            name: "专业版",
            price: 99,
            features: ["高级功能", "20个用户", "10GB存储", "优先支持"],
          },
          {
            name: "企业版",
            price: 299,
            features: [
              "全部功能",
              "无限用户",
              "100GB存储",
              "专属客服",
              "API访问",
            ],
          },
          {
            name: "旗舰版",
            price: 999,
            features: ["定制功能", "无限一切", "私有部署", "专属顾问"],
          },
        ];
        return {
          id: faker.string.uuid(),
          ...plans[index],
          billingPeriod: "monthly",
          isPublic: true,
          order: index + 1,
          createdAt: faker.date.past({ years: 2 }),
        };
      },
    },

    tenants: {
      count: Math.max(baseCount, 100),
      generator: (index, pools) => ({
        id: faker.string.uuid(),
        name: faker.company.name(),
        slug: faker.helpers.slugify(faker.company.name()),
        planId: faker.helpers.arrayElement(pools.plans).id,
        status: weightedRandom({
          trial: 0.2,
          active: 0.7,
          suspended: 0.05,
          churned: 0.05,
        }),
        trialEndsAt: faker.date.soon({ days: 14 }),
        userCount: faker.number.int({ min: 1, max: 50 }),
        storageUsed: faker.number.int({ min: 100, max: 10000 }) * 1024 * 1024,
        settings: {
          timezone: "Asia/Shanghai",
          language: "zh-CN",
        },
        createdAt: generateCreatedAt(index, baseCount),
      }),
    },

    users: {
      count: Math.floor(baseCount * 3),
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
            member: 0.8,
          }),
          status: weightedRandom({
            active: 0.85,
            invited: 0.1,
            suspended: 0.05,
          }),
          lastLoginAt: faker.date.recent(),
          createdAt: generateCreatedAt(index, baseCount * 3),
        };
      },
    },

    subscriptions: {
      count: Math.floor(baseCount * 0.8),
      generator: (index, pools) => {
        const tenant =
          pools.tenants[index % pools.tenants.length] ||
          faker.helpers.arrayElement(pools.tenants);
        const plan = faker.helpers.arrayElement(pools.plans);
        return {
          id: faker.string.uuid(),
          tenantId: tenant.id,
          planId: plan.id,
          status: weightedRandom({
            active: 0.8,
            past_due: 0.1,
            cancelled: 0.1,
          }),
          currentPeriodStart: faker.date.recent(),
          currentPeriodEnd: faker.date.soon({ days: 30 }),
          cancelAtPeriodEnd: Math.random() > 0.9,
          createdAt: generateCreatedAt(index, baseCount * 0.8),
        };
      },
    },

    tickets: {
      count: Math.floor(baseCount * 1.5),
      generator: (index, pools) => {
        const tenant = faker.helpers.arrayElement(pools.tenants);
        const user =
          pools.users.find((u: any) => u.tenantId === tenant.id) ||
          faker.helpers.arrayElement(pools.users);
        return {
          id: faker.string.uuid(),
          tenantId: tenant.id,
          userId: user.id,
          subject: faker.lorem.sentence({ min: 5, max: 10 }),
          description: faker.lorem.paragraphs(2),
          priority: weightedRandom({
            low: 0.3,
            medium: 0.5,
            high: 0.15,
            urgent: 0.05,
          }),
          status: weightedRandom({
            open: 0.2,
            pending: 0.3,
            resolved: 0.4,
            closed: 0.1,
          }),
          assigneeId: Math.random() > 0.3 ? "admin-001" : null,
          messages: Array.from(
            { length: faker.number.int({ min: 1, max: 10 }) },
            () => ({
              id: faker.string.uuid(),
              content: faker.lorem.paragraph(),
              authorType: faker.helpers.arrayElement(["user", "support"]),
              createdAt: faker.date.recent(),
            })
          ),
          createdAt: generateCreatedAt(index, baseCount * 1.5),
          resolvedAt: Math.random() > 0.5 ? faker.date.recent() : null,
        };
      },
    },
  };
}

// ---------- 技能平台业务 [v3.3 NEW] ----------
function getSkillPlatformSeedConfig(baseCount: number): Record<string, SeedConfig> {
  return {
    categories: {
      count: 10,
      generator: () => ({
        id: faker.string.uuid(),
        name: faker.helpers.arrayElement([
          "内容创作", "数据分析", "代码开发", "产品管理", "设计创意",
          "市场营销", "客户服务", "财务管理", "人力资源", "项目管理",
        ]),
        description: faker.lorem.sentence(),
        order: faker.number.int({ min: 1, max: 100 }),
        skillCount: 0,
        createdAt: faker.date.past({ years: 1 }),
      }),
    },

    users: {
      count: Math.max(baseCount, 100),
      generator: (index) => ({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        emailVerified: Math.random() > 0.2,
        image: faker.image.avatar(),
        role: weightedRandom({ user: 0.9, admin: 0.1 }),
        createdAt: generateCreatedAt(index, baseCount),
        updatedAt: faker.date.recent(),
      }),
    },

    adminUsers: {
      count: Math.floor(baseCount * 0.15),
      generator: (index) => ({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        emailVerified: true,
        image: faker.image.avatar(),
        role: weightedRandom({ admin: 0.8, super_admin: 0.2 }),
        createdAt: generateCreatedAt(index, Math.floor(baseCount * 0.15)),
        updatedAt: faker.date.recent(),
      }),
    },

    skills: {
      count: Math.floor(baseCount * 1.2),
      generator: (index, pools) => {
        const status = weightedRandom({
          draft: 0.1,
          published: 0.8,
          archived: 0.1,
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
          createdAt: generateCreatedAt(index, Math.floor(baseCount * 1.2)),
          updatedAt: faker.date.recent(),
          publishedAt: status === "published" ? faker.date.past() : null,
        };
      },
    },

    auditLogs: {
      count: Math.floor(baseCount * 5),
      generator: (index, pools) => {
        const allUsers = [...pools.users, ...pools.adminUsers];
        const actor = faker.helpers.arrayElement(allUsers);
        return {
          id: faker.string.uuid(),
          userId: actor.id,
          action: faker.helpers.arrayElement([
            "user.create", "user.update", "user.delete", "user.login",
            "skill.create", "skill.update", "skill.delete", "skill.publish",
            "category.create", "category.update",
            "settings.update", "admin.login",
          ]),
          entityType: faker.helpers.arrayElement(["user", "skill", "category", "settings"]),
          entityId: faker.string.uuid(),
          oldValues: Math.random() > 0.5 ? { status: "draft" } : null,
          newValues: Math.random() > 0.5 ? { status: "published" } : null,
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent(),
          createdAt: generateCreatedAt(index, Math.floor(baseCount * 5)),
        };
      },
    },
  };
}

// ---------- BI 报表数据 [v3.3 NEW] ----------
function getBiReportsSeedConfig(baseCount: number): Record<string, SeedConfig> {
  return {
    subscriptionPlans: {
      count: 5,
      generator: (index) => {
        const plans = [
          { name: "Free", nameZh: "免费版", price: 0, interval: "monthly" },
          { name: "Basic", nameZh: "基础版", price: 900, interval: "monthly" },
          { name: "Pro", nameZh: "专业版", price: 2900, interval: "monthly" },
          { name: "Team", nameZh: "团队版", price: 9900, interval: "monthly" },
          { name: "Enterprise", nameZh: "企业版", price: 29900, interval: "monthly" },
        ];
        const plan = plans[index] || plans[0];
        return {
          id: `plan_${plan.name.toLowerCase()}`,
          name: plan.name,
          nameZh: plan.nameZh,
          price: plan.price,
          interval: plan.interval,
          features: faker.lorem.words({ min: 3, max: 6 }).split(" "),
          isActive: true,
          order: index + 1,
          createdAt: faker.date.past({ years: 2 }),
        };
      },
    },

    userSubscriptions: {
      count: Math.floor(baseCount * 0.7),
      generator: (index, pools) => {
        // 需要从外部传入 users 池
        const userId = pools.users?.[index % (pools.users?.length || 1)]?.id || faker.string.uuid();
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
          userId,
          planId: plan.id,
          status,
          startDate,
          endDate,
          cancelledAt: status === "cancelled" ? faker.date.recent() : null,
          cancelReason: status === "cancelled"
            ? faker.helpers.arrayElement(["价格太高", "功能不够", "不再需要", "换用其他产品"])
            : null,
          createdAt: startDate,
        };
      },
    },

    userEvents: {
      count: Math.floor(baseCount * 6),
      generator: (index, pools) => {
        const userId = pools.users?.[index % (pools.users?.length || 1)]?.id || faker.string.uuid();
        const eventType = weightedRandom({
          visit: 0.35,
          signup: 0.12,
          activate: 0.1,
          subscribe: 0.08,
          renew: 0.1,
          refer: 0.05,
          churn: 0.05,
          upgrade: 0.08,
          downgrade: 0.07,
        });

        return {
          id: faker.string.uuid(),
          userId,
          eventType,
          eventValue: ["subscribe", "renew", "upgrade"].includes(eventType)
            ? faker.number.int({ min: 900, max: 29900 })
            : null,
          metadata: JSON.stringify({
            browser: faker.helpers.arrayElement(["Chrome", "Safari", "Firefox", "Edge"]),
            device: faker.helpers.arrayElement(["desktop", "mobile", "tablet"]),
          }),
          source: faker.helpers.arrayElement(["organic", "referral", "paid_ads", "social", "direct"]),
          createdAt: faker.date.past({ days: 120 }),
        };
      },
    },

    dailyMetrics: {
      count: 120,
      generator: (index) => {
        const date = new Date();
        date.setDate(date.getDate() - (120 - index));
        const dateStr = date.toISOString().split("T")[0];

        // 模拟业务增长
        const dayProgress = index / 120;
        const growthFactor = 1 + dayProgress * 0.5;
        const randomVariance = 0.8 + Math.random() * 0.4;

        const visitors = Math.floor(300 * growthFactor * randomVariance);
        const signups = Math.floor(visitors * (0.15 + Math.random() * 0.1));
        const activations = Math.floor(signups * (0.5 + Math.random() * 0.2));
        const conversions = Math.floor(activations * (0.15 + Math.random() * 0.1));

        const revenue = conversions * faker.number.int({ min: 900, max: 9900 });
        const orders = conversions;
        const avgOrderValue = orders > 0 ? Math.floor(revenue / orders) : 0;

        const activeUsers = Math.floor(150 * growthFactor * randomVariance);
        const churnedUsers = Math.floor(activeUsers * (0.02 + Math.random() * 0.03));
        const renewals = Math.floor(activeUsers * (0.05 + Math.random() * 0.05));

        const referrals = Math.floor(activeUsers * (0.02 + Math.random() * 0.02));
        const referralConversions = Math.floor(referrals * (0.2 + Math.random() * 0.2));

        const apiCalls = Math.floor(3000 * growthFactor * randomVariance);
        const apiCost = Math.floor(apiCalls * 0.01);
        const infrastructureCost = faker.number.int({ min: 800, max: 1500 });

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
}

// ==================== 主函数 ====================

interface GenerateResult {
  entity: string;
  count: number;
  data: any[];
}

async function generateSeedData(
  businessType: string,
  baseCount: number
): Promise<GenerateResult[]> {
  const configGetters: Record<
    string,
    (count: number) => Record<string, SeedConfig>
  > = {
    blog: getBlogSeedConfig,
    ecommerce: getEcommerceSeedConfig,
    saas: getSaasSeedConfig,
    "skill-platform": getSkillPlatformSeedConfig,
    "bi-reports": getBiReportsSeedConfig,
  };

  const getConfig = configGetters[businessType];
  if (!getConfig) {
    throw new Error(
      `Unknown business type: ${businessType}. Available: blog, ecommerce, saas, skill-platform, bi-reports`
    );
  }

  const config = getConfig(baseCount);
  const pools: Record<string, any[]> = {};
  const results: GenerateResult[] = [];

  console.log(`\n[Seed Generator] Business type: ${businessType}`);
  console.log(`[Seed Generator] Base count: ${baseCount}`);
  console.log("─".repeat(50));

  for (const [entityName, entityConfig] of Object.entries(config)) {
    console.log(`Generating ${entityConfig.count} ${entityName}...`);

    const data = [];
    for (let i = 0; i < entityConfig.count; i++) {
      const item = entityConfig.generator(i, pools);
      data.push(item);
    }

    pools[entityName] = data;
    results.push({
      entity: entityName,
      count: data.length,
      data,
    });

    console.log(`  ✓ ${entityName}: ${data.length} records`);
  }

  console.log("─".repeat(50));
  console.log(
    `Total: ${results.reduce((sum, r) => sum + r.count, 0)} records\n`
  );

  return results;
}

/**
 * 生成 SQL INSERT 语句
 */
function generateSQLInserts(results: GenerateResult[]): string {
  let sql = "-- Generated Seed Data\n-- Run this SQL to insert test data\n\n";

  for (const { entity, data } of results) {
    if (data.length === 0) continue;

    sql += `-- ${entity} (${data.length} records)\n`;

    // 获取所有字段名
    const fields = Object.keys(data[0]);

    // 批量插入（每100条一批）
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      sql += `INSERT INTO "${entity}" (${fields.map((f) => `"${f}"`).join(", ")}) VALUES\n`;

      const values = batch.map((row) => {
        const vals = fields.map((field) => {
          const val = row[field];
          if (val === null || val === undefined) return "NULL";
          if (typeof val === "string")
            return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return val;
        });
        return `  (${vals.join(", ")})`;
      });

      sql += values.join(",\n") + ";\n\n";
    }
  }

  return sql;
}

/**
 * 生成 JSON 格式数据
 */
function generateJSON(results: GenerateResult[]): string {
  const data: Record<string, any[]> = {};
  for (const { entity, data: entityData } of results) {
    data[entity] = entityData;
  }
  return JSON.stringify(data, null, 2);
}

// ==================== CLI 入口 ====================

async function main() {
  const args = process.argv.slice(2);

  // 解析参数
  const businessType = args.find((a) => !a.startsWith("--")) || "blog";
  const countArg = args.find((a) => a.startsWith("--count="));
  const baseCount = countArg ? parseInt(countArg.split("=")[1], 10) : 100;
  const formatArg = args.find((a) => a.startsWith("--format="));
  const format = formatArg ? formatArg.split("=")[1] : "json";
  const outputArg = args.find((a) => a.startsWith("--output="));
  const outputFile = outputArg ? outputArg.split("=")[1] : null;

  try {
    const results = await generateSeedData(businessType, baseCount);

    // 生成输出
    let output: string;
    if (format === "sql") {
      output = generateSQLInserts(results);
    } else {
      output = generateJSON(results);
    }

    // 输出到文件或控制台
    if (outputFile) {
      await Bun.write(outputFile, output);
      console.log(`Output written to: ${outputFile}`);
    } else {
      console.log("\n--- Generated Data Preview (first 2 records per entity) ---\n");
      for (const { entity, data } of results) {
        console.log(`${entity}:`);
        console.log(JSON.stringify(data.slice(0, 2), null, 2));
        console.log("...\n");
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();

// ==================== 导出供其他脚本使用 ====================

export {
  generateSeedData,
  generateSQLInserts,
  generateJSON,
  getBlogSeedConfig,
  getEcommerceSeedConfig,
  getSaasSeedConfig,
  getSkillPlatformSeedConfig,
  getBiReportsSeedConfig,
  weightedRandom,
  generateCreatedAt,
  generateChinesePhone,
  generateChineseAddress,
};
