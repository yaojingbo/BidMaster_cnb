'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Terminal, XCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { authFetch } from '@/lib/auth-fetch';

function CliAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceCode = searchParams.get('device_code') || '';
  const { authReady, isAuthenticated, user, initAuth } = useAuthStore();
  const [authorizing, setAuthorizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authReady) {
      initAuth();
    }
  }, [authReady, initAuth]);

  const handleLogin = () => {
    const callbackUrl = `/cli-auth?device_code=${encodeURIComponent(deviceCode)}`;
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const handleAuthorize = async () => {
    if (!deviceCode) return;
    setAuthorizing(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/cli-auth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: deviceCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `授权失败：HTTP ${res.status}`);
      setSuccess(true);
      setMessage('授权成功，可以回到命令行继续使用 Bid Master CLI。');
    } catch (err) {
      setSuccess(false);
      setMessage(err instanceof Error ? err.message : '授权失败，请重试');
    } finally {
      setAuthorizing(false);
    }
  };

  if (!deviceCode) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-sm">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-5 text-2xl font-bold">授权链接无效</h1>
        <p className="mt-3 text-sm text-muted-foreground">请在命令行重新执行 bidmaster auth login。</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Terminal className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-center text-2xl font-bold">授权 Bid Master CLI</h1>
      <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">
        你正在授权本机命令行调用网页端服务。授权后，本机 CLI 会获得专用访问令牌。
      </p>

      <div className="mt-6 rounded-xl bg-muted/50 p-4 text-center">
        <p className="text-xs text-muted-foreground">设备授权码</p>
        <p className="mt-1 break-all font-mono text-sm text-foreground">{deviceCode}</p>
      </div>

      {!authReady ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在确认登录状态...
        </div>
      ) : !isAuthenticated ? (
        <button
          onClick={handleLogin}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          先登录网页账号
        </button>
      ) : success ? (
        <div className="mt-6 rounded-xl bg-success/10 p-4 text-center text-success">
          <CheckCircle2 className="mx-auto h-8 w-8" />
          <p className="mt-2 text-sm font-medium">{message}</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            当前登录账号：<span className="font-medium text-foreground">{user?.username}</span>
          </p>
          <button
            onClick={handleAuthorize}
            disabled={authorizing}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {authorizing && <Loader2 className="h-4 w-4 animate-spin" />}
            授权本机 CLI
          </button>
        </>
      )}

      {message && !success && <p className="mt-4 text-center text-sm text-destructive">{message}</p>}
    </div>
  );
}

export default function CliAuthPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">加载中...</div>}>
      <CliAuthContent />
    </Suspense>
  );
}
