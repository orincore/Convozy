'use client';

import Link from 'next/link';
import { CaretUpDown, Check, CircleNotch, Plus, SquaresFour } from '@phosphor-icons/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConnectedAccount } from '@/lib/api';
import { cn } from '@/lib/cn';
import { initials } from '@/components/tickets/ticket-meta';
import { useAccounts } from './account-context';

export function AccountAvatar({ account, className }: { account: ConnectedAccount | null; className?: string }) {
  return (
    <Avatar className={cn('size-8', className)}>
      {account?.profilePictureUrl && (
        <AvatarImage src={account.profilePictureUrl} alt={`@${account.igUsername}`} referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className="text-[0.6875rem]">{initials(account?.igUsername, 'IG')}</AvatarFallback>
    </Avatar>
  );
}

/**
 * The account this whole dashboard is working on. Everything below it in the
 * sidebar (automations, contacts, tickets...) belongs to the selected account.
 */
export function AccountSwitcher({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { accounts, selected, select, connect, connecting } = useAccounts();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={selected ? `Instagram account @${selected.igUsername}. Switch account` : 'Choose an Instagram account'}
          title={collapsed ? (selected ? `@${selected.igUsername}` : 'Instagram account') : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-[1.25rem] border border-border bg-card text-left transition-colors hover:border-muted-foreground',
            collapsed ? 'justify-center p-2' : 'px-3 py-2.5',
          )}
        >
          <AccountAvatar account={selected} className="size-9" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-foreground">
                  {selected ? selected.displayName || selected.igUsername : 'Connect Instagram'}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {selected ? `@${selected.igUsername}` : 'No account yet'}
                </span>
              </span>
              <CaretUpDown size={15} className="shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {accounts.length > 0 && <DropdownMenuLabel className="text-xs text-muted-foreground">Instagram accounts</DropdownMenuLabel>}
        {accounts.map((a) => (
          <DropdownMenuItem key={a.id} onSelect={() => select(a.id)} className="gap-3 py-2">
            <AccountAvatar account={a} className="size-7" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{a.displayName || a.igUsername}</span>
              <span className="block truncate text-xs text-muted-foreground">@{a.igUsername}</span>
            </span>
            {a.id === selected?.id && <Check size={14} weight="bold" />}
          </DropdownMenuItem>
        ))}
        {accounts.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => void connect()} disabled={connecting} className="gap-2">
          {connecting ? <CircleNotch size={15} className="animate-spin" /> : <Plus size={15} />}
          Add account
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/app" onClick={onNavigate}>
            <SquaresFour size={15} />
            Manage accounts
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
