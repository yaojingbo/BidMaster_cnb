"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuthStore } from "@/stores/auth-store";

const protectedRoutes: string[] = [];
const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initAuth, authReady, isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const initialized = useRef(false);
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));

  useEffect(() => {
    if (authDisabled) return;
    if (initialized.current) return;
    initialized.current = true;
    // authReady 已为 true 说明刚完成 login/register，无需再 initAuth
    // 否则 initAuth 若偶发失败会覆盖 isAuthenticated=false 并清除 cookie，导致导航被重定向
    if (!useAuthStore.getState().authReady) {
      initAuth();
    }
  }, [initAuth]);

  // initAuth 完成后，若用户未认证且在受保护路由，客户端侧回退重定向
  useEffect(() => {
    if (authDisabled) return;
    if (!authReady) return;
    const isProtectedRoute = protectedRoutes.some(r => pathname.startsWith(r));
    if (!isAuthenticated && isProtectedRoute) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [authReady, isAuthenticated, pathname, router]);

  // 只有受保护页面需要等待认证完成，公共页面优先渲染，减少导航等待感
  if (!authDisabled && isProtected && !authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main>
        <div className="mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-16">
          {children}
        </div>
      </main>
    </div>
  );
}
