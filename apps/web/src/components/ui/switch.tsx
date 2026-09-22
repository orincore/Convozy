'use client';

import type { InputHTMLAttributes } from 'react';
import styles from './switch.module.css';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

/**
 * On/off toggle for automations (adapted from uiverse.io, see switch.module.css).
 * `label` is required and visually hidden by default - pass an id'd
 * <Label> alongside it in forms, or rely on this prop for icon-only usage.
 */
export function Switch({ checked, onCheckedChange, label, id, disabled, ...props }: SwitchProps) {
  return (
    <label className={styles.wrapper} htmlFor={id}>
      <span className="sr-only">{label}</span>
      <span className={styles.outer}>
        <input
          {...props}
          id={id}
          type="checkbox"
          className={styles.input}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span className={styles.button}>
          <span className={styles.toggle} />
          <span className={styles.indicator} />
        </span>
      </span>
    </label>
  );
}
