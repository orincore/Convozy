'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { AutomationForm } from '@/components/automations/automation-form';
import { ApiError, Automation, ConnectedAccount, automationsApi, instagramApi } from '@/lib/api';

export default function EditAutomationPage() {
  const params = useParams<{ id: string }>();
  const automationId = params.id;

  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([instagramApi.listAccounts(), automationsApi.get(automationId)])
      .then(([accountList, found]) => {
        setAccounts(accountList);
        setAutomation(found);
      })
      .catch((err: ApiError) => setError(err.message));
  }, [automationId]);

  if (!error && (accounts === null || automation === null)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/automations">Back to automations</Link>
        </Button>
      </div>
    );
  }

  return <AutomationForm accounts={accounts ?? []} automation={automation ?? undefined} />;
}
