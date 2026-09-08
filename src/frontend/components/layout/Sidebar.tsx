'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileSearch,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  LogIn,
  UserPlus,
  User,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Terminal,
  BookOpen,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BidMasterLogo } from '@/components/layout/BidMasterLogo';
import { useAuthStore } from '@/stores/auth-store';

const navItems = [
  { href: '/', label: '首页', icon: LayoutDashboard },
  { href: '/workbench', label: '功能', icon: FileSearch },
  { href: '/cli', label: 'CLI', icon: Terminal },
  { href: '/database', label: '文件管理', icon: FolderOpen },
  { href: '/knowledge', label: '知识库', icon: BookOpen },
  { href: '/settings', label: 'AI 设置', icon: SlidersHorizontal },
];

const docsItems = [
  { href: '/docs', label: '文档说明', external: false },
  { href: 'https://cnb.cool/yaojingbo-2026/bidmasterISSUE', label: 'Issue 反馈', external: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setPendingHref(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center leading-none">
          <BidMasterLogo markClassName="h-9 w-9 rounded-xl" />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map(item => {
            const active = pathname === item.href;
            const pending = pendingHref === item.href && !active;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setPendingHref(item.href)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors lg:px-4',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  pending && 'bg-muted/70 text-foreground'
                )}
                aria-busy={pending}
              >
                <item.icon className={cn('h-4 w-4', pending && 'animate-pulse')} />
                {item.label}
              </Link>
            );
          })}
          <div className="group relative">
            <button
              type="button"
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors lg:px-4',
                pathname === '/docs'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <BookOpen className="h-4 w-4" />
              文档
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
            </button>
            <div className="invisible absolute right-0 top-full z-50 mt-2 w-36 rounded-xl border border-border bg-background p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
              {docsItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  onClick={() => !item.external && setPendingHref(item.href)}
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* 桌面端右侧操作区 */}
        <div className="hidden shrink-0 items-center justify-end gap-2 md:flex sm:gap-3">
          <Link
            href="/docs"
            title="文档说明"
            aria-label="文档说明"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              pathname === '/docs' && 'bg-muted text-primary'
            )}
          >
            <BookOpen className="h-4 w-4" />
          </Link>
          <Link
            href="/logs"
            title="系统日志"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              pathname === '/logs' && 'bg-muted text-primary'
            )}
          >
            <ScrollText className="h-4 w-4" />
          </Link>
          {isLoading ? (
            <span className="text-xs text-muted-foreground">加载中...</span>
          ) : isAuthenticated && user && user.role !== "guest" ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-bold text-primary">{user.username[0]}</span>
              </div>
              <span className="hidden max-w-20 truncate text-sm font-medium text-foreground lg:inline">
                {user.username}
              </span>
              <button
                onClick={logout}
                title="退出登录"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1.5 text-sm text-muted-foreground xl:flex">
                <User className="h-4 w-4" />
                <span>游客</span>
              </div>
              <Link
                href="/login"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogIn className="h-4 w-4" />
                登录
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" />
                注册
              </Link>
            </div>
          )}
        </div>

        {/* 移动端：用户头像 + 菜单按钮 */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          {isAuthenticated && user && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-bold text-primary">{user.username[0]}</span>
            </div>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(v => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 移动端抽屉菜单 */}
      {mobileOpen && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="关闭菜单"
            className="fixed inset-0 top-16 z-30 cursor-default bg-foreground/20"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="relative z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border bg-background px-4 py-4 shadow-lg">
            <div className="space-y-1">
              {navItems.map(item => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setPendingHref(item.href)}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/logs"
                className={cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                  pathname === '/logs'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <ScrollText className="h-4 w-4" />
                系统日志
              </Link>
            </div>

            <div className="my-3 border-t border-border" />

            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">文档</p>
            <div className="space-y-1">
              {docsItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <BookOpen className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="my-3 border-t border-border" />

            {isLoading ? (
              <p className="px-3 text-sm text-muted-foreground">加载中...</p>
            ) : isAuthenticated && user ? (
              <div className="flex items-center justify-between px-3 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-bold text-primary">{user.username[0]}</span>
                  </div>
                  <span className="truncate text-sm font-medium text-foreground">
                    {user.username}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-1">
                <Link
                  href="/login"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <LogIn className="h-4 w-4" />
                  登录
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <UserPlus className="h-4 w-4" />
                  注册
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
