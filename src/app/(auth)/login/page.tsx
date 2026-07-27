"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { saveCredentials, loadCredentials, clearCredentials } from "@/lib/remember-credentials";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading } = useAuthStore();

  useEffect(() => {
    const saved = loadCredentials();
    if (saved) {
      setEmail(saved.email);
      setPassword(saved.password);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      if (rememberMe) {
        saveCredentials(email, password);
      } else {
        clearCredentials();
      }
      router.push(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <span className="text-foreground font-bold text-xl">Bid Master</span>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">登录</h1>
        <p className="text-muted-foreground mt-1">招投标智能分析工具箱</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="text-sm font-medium mb-1 block">邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="输入邮箱地址"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="输入密码"
            required
          />
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="remember-me" className="text-xs text-muted-foreground">
                记住密码
              </label>
            </div>
            <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
              忘记密码？
            </a>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          登录
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        没有账号？{" "}
        <a href="/register" className="text-primary hover:underline">
          注册新用户
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  );
}