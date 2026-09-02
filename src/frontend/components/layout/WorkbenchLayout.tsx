'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Database,
  FileSearch,
  FileText,
  Globe2,
  Home,
  LogIn,
  LogOut,
  UserPlus,
  ScrollText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BidMasterLogo } from '@/components/layout/BidMasterLogo';
import { useAuthStore } from '@/stores/auth-store';

type WorkbenchLayoutProps = {
  children: React.ReactNode;
};

const workspaceNav = [
  {
    title: '项目机会查询',
    items: [{ href: '/project-query', label: '项目查询', icon: Globe2 }],
  },
  {
    title: '招标文件处理',
    items: [
      { href: '/extract', label: '要素提取', icon: FileSearch },
      { href: '/simulate', label: '模拟编制', icon: FileText },
    ],
  },
  {
    title: '开标数据分析',
    items: [{ href: '/statistics', label: '开标分析', icon: BarChart3 }],
  },
  {
    title: '知识与数据',
    items: [
      { href: '/database', label: '文件管理', icon: Database },
      { href: '/knowledge', label: '知识库', icon: BookOpen },
    ],
  },
  {
    title: '系统工具',
    items: [
      { href: '/settings', label: 'AI 设置', icon: Settings },
      { href: '/logs', label: '系统日志', icon: ScrollText },
    ],
  },
];

export function WorkbenchLayout({ children }: WorkbenchLayoutProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  return (
    <div className="mx-auto flex max-w-none gap-4 px-0 lg:gap-8">
      <aside className="hidden min-h-[calc(100vh-10rem)] w-56 shrink-0 flex-col border-r border-border pr-4 lg:flex">
        <div className="mb-8 px-2">
          <BidMasterLogo markClassName="h-9 w-9 rounded-xl" />
        </div>

        <nav className="flex-1 space-y-6">
          <Link
            href="/workbench"
            className={cn(
              'flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors',
              pathname === '/workbench'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Home className="h-4 w-4" />
            首页
          </Link>

          {workspaceNav.map(group => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">{group.title}</p>
              <div className="space-y-1">
                {group.items.map(item => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-4 px-3 pt-8">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">用户信息加载中...</div>
          ) : isAuthenticated && user ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {user.username[0]}
                  </div>
                  <span className="truncate text-sm font-medium text-foreground">
                    {user.username}
                  </span>
                </div>
                <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    游
                  </div>
                  <span className="text-sm font-medium text-foreground">游客</span>
                </div>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <Link
                href="/register"
                className="flex items-center gap-2 text-sm font-medium text-primary"
              >
                <UserPlus className="h-4 w-4" />
                注册账号
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <LogIn className="h-4 w-4" />
                登录
              </Link>
            </>
          )}
        </div>
      </aside>

      <div className="mb-4 flex gap-2 overflow-x-auto px-1 lg:hidden">
        <Link href="/database" className="rounded-full border px-3 py-2 text-sm text-muted-foreground">
          文件管理
        </Link>
        <Link href="/knowledge" className="rounded-full border px-3 py-2 text-sm font-medium text-primary">
          知识库
        </Link>
      </div>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
