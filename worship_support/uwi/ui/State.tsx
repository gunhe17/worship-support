import Button from "@/ui/Button";

export function Empty({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="enter-fade flex flex-col items-center gap-4 py-10 text-center">
      <p className="text-body text-sub">{text}</p>
      {action && onAction ? (
        <Button tone="line" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}

export function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="enter-fade flex flex-col items-center gap-4 py-10 text-center" role="alert">
      <p className="text-body text-sub">{message}</p>
      <Button tone="line" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
