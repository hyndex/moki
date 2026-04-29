import * as React from "react";
import { Composer } from "../components/composer/Composer";
import { useConnections } from "../hooks/use-connections";

export function MailComposePage(): React.ReactElement {
  const { defaultConnection } = useConnections();
  return (
    <div className="flex h-full flex-col bg-surface-1">
      <header className="px-6 pt-6 pb-3 border-b border-border bg-surface-0">
        <h1 className="text-xl font-semibold text-text-primary">Compose</h1>
        <p className="text-sm text-text-muted mt-0.5">Draft a new message.</p>
      </header>
      <div className="grid flex-1 place-items-center p-6">
        <div className="w-full max-w-3xl">
          <Composer
            id={`page-${Date.now()}`}
            mode="new"
            defaultConnectionId={defaultConnection?.id}
          />
        </div>
      </div>
    </div>
  );
}
