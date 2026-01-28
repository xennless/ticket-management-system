import {
  Shield,
  Headset,
  UserCog,
  Wrench,
  BadgeCheck,
  Building2,
  Users,
  Ticket,
  KeyRound,
  Crown,
  LifeBuoy,
  Settings,
  FileText,
  Briefcase
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export const roleIcons = {
  shield: Shield,
  headset: Headset,
  userCog: UserCog,
  wrench: Wrench,
  badgeCheck: BadgeCheck,
  building: Building2,
  users: Users,
  ticket: Ticket,
  key: KeyRound,
  crown: Crown,
  lifeBuoy: LifeBuoy,
  settings: Settings,
  fileText: FileText,
  briefcase: Briefcase
} as const;

export type RoleIconKey = keyof typeof roleIcons;

export function RoleIcon({ icon, className }: { icon?: string | null; className?: string }) {
  if (!icon) {
    const Comp = Shield;
    return <Comp className={className ?? 'w-4 h-4'} />;
  }
  
  // Önce küçük harfli key olarak dene (eski format: "shield", "headset", vb.)
  let key = icon.toLowerCase() as RoleIconKey;
  let Comp = (roleIcons as any)[key];
  
  // Eğer bulunamazsa, Lucide icon ismi olarak dene (yeni format: "Shield", "Headset", vb.)
  if (!Comp) {
    // Lucide icon ismini direkt import etmeyi dene
    Comp = (LucideIcons as any)[icon] || (LucideIcons as any)[`${icon}Icon`];
  }
  
  // Hala bulunamazsa Shield kullan
  if (!Comp) {
    Comp = Shield;
  }
  
  return <Comp className={className ?? 'w-4 h-4'} />;
}


