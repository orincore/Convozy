'use client';

import { AutomationForm } from '@/components/automations/automation-form';
import { useAccounts } from '@/components/dashboard/account-context';

export default function NewAutomationPage() {
  const { selected } = useAccounts();

  // Automations belong to the account selected in the sidebar, so that is the
  // only account a new one can be created for.
  return <AutomationForm accounts={selected ? [selected] : []} />;
}
