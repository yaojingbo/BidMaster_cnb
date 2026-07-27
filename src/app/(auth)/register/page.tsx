"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { authSendCode } from "@/lib/auth-api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const { register, isLoading } = useAuthStore();

  const handleSendCode = useCallback(async () => {
    if (!email || codeCooldown > 0) return;
    setError(null);
    setSendingCode(true);
    try {
      await authSendCode(email);
      setCodeSent(true);
      setCodeCooldown(60);
      const timer = setInterval(() => {
        setCodeCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送验证码失败");
    } finally {
      setSendingCode(false);
    }
  }, [email, codeCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    try {
      await register(email, password, confirmPassword, code, username || undefined);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
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
        <h1 className="text-2xl font-bold tracking-tight">注册</h1>
        <p className="text-muted-foreground mt-1">创建新用户账号</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="text-sm font-medium mb-1 block">邮箱</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="输入邮箱地址"
              autoComplete="email"
              required
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={!email || codeCooldown > 0 || sendingCode}
              className="px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 whitespace-nowrap"
            >
              {sendingCode ? "发送中..." : codeCooldown > 0 ? `${codeCooldown}s` : "发送验证码"}
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">验证码</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="输入 6 位验证码"
            maxLength={6}
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
            placeholder="至少 6 个字符"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">确认密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="再次输入密码"
            required
            minLength={6}
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-destructive mt-1">两次输入的密码不一致</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">用户名（可选）</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="留空则自动生成"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !codeSent}
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          注册
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        已有账号？{" "}
        <a href="/login" className="text-primary hover:underline">登录</a>
      </p>
    </div>
  );
}
