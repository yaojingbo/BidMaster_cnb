import { cn } from '@/lib/utils';

type BidMasterLogoProps = {
  className?: string;
  markClassName?: string;
  showText?: boolean;
};

export function BidMasterLogo({ className, markClassName, showText = true }: BidMasterLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm',
          markClassName
        )}
      >
        <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-white/85" />
        <div className="absolute bottom-2 right-2 h-3 w-3 rounded-full border-2 border-white/80" />
        <div className="h-5 w-4 rounded-sm border-2 border-white/90 bg-white/10" />
        <div className="absolute h-1 w-5 rotate-45 rounded-full bg-white/90" />
      </div>
      {showText && (
        <div className="leading-none">
          <p className="text-xl font-bold tracking-tight text-primary">Bid Master</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            AI Tender Suite
          </p>
        </div>
      )}
    </div>
  );
}
