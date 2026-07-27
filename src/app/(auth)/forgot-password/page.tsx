"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle } from "lucide-react";
import { authForgotPassword } from "@/lib/auth-api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authForgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <span className="text-foreground font-bold text-xl">Bid Master</span>
        </div>
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">邮件已发送</h1>
          <p className="text-muted-foreground">
            如果该邮箱已注册，重置密码链接已发送到 <strong>{email}</strong>，请查收邮件。
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className="text-primary hover:underline">返回登录</a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <span className="text-foreground font-bold text-xl">Bid Master</span>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">忘记密码</h1>
        <p className="text-muted-foreground mt-1">输入注册邮箱，我们将发送重置链接</p>
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
            placeholder="输入注册邮箱"
            autoComplete="email"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          发送重置链接
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <a href="/login" className="text-primary hover:underline">返回登录</a>
      </p>
    </div>
  );
}
