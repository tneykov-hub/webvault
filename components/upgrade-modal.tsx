"use client";

import { Check, Crown } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FREE_CATEGORY_LIMIT, FREE_SITE_LIMIT } from "@/lib/plans";

export function UpgradeModal({ open, onOpenChange, reason, language }: { open: boolean; onOpenChange: (open: boolean) => void; reason?: string; language: "en" | "bg" }) {
  const copy = language === "bg" ? {
    title: "Достигна лимита на безплатния план",
    description: reason ?? "Стани PRO за неограничени сайтове, категории и всички premium функции.",
    price: "3,99 € / месец",
    annual: "или 29 € / година",
    sites: "Неограничени сайтове и категории",
    sync: "Sync на всички устройства и неограничен import",
    extras: "Custom иконки, PWA и приоритетна поддръжка",
    cancel: "Не сега",
    upgrade: "Стани PRO",
    free: `FREE включва до ${FREE_SITE_LIMIT} сайта, ${FREE_CATEGORY_LIMIT} категории и 1 устройство.`,
  } : {
    title: "You reached the FREE plan limit",
    description: reason ?? "Go PRO for unlimited sites, categories and every premium feature.",
    price: "€3.99 / month",
    annual: "or €29 / year",
    sites: "Unlimited sites and categories",
    sync: "Sync on every device and unlimited import",
    extras: "Custom icons, PWA and priority support",
    cancel: "Not now",
    upgrade: "Go PRO",
    free: `FREE includes up to ${FREE_SITE_LIMIT} sites, ${FREE_CATEGORY_LIMIT} categories and 1 device.`,
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-panel upgrade-dialog">
        <DialogHeader className="dialog-heading">
          <span className="modal-icon upgrade-icon"><Crown size={20} /></span>
          <div>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="upgrade-plan-summary">
          <span className="upgrade-plan-label">WEBVAULT PRO</span>
          <strong>{copy.price} <small>{copy.annual}</small></strong>
          <ul>
            <li><Check size={16} /> {copy.sites}</li>
            <li><Check size={16} /> {copy.sync}</li>
            <li><Check size={16} /> {copy.extras}</li>
          </ul>
        </div>
        <div className="upgrade-dialog-actions">
          <button type="button" className="cancel" onClick={() => onOpenChange(false)}>{copy.cancel}</button>
          <Link className="add-button" href={`/pricing?lang=${language}`} onClick={() => onOpenChange(false)}><Crown size={17} />{copy.upgrade}</Link>
        </div>
        <p className="upgrade-free-note">{copy.free}</p>
      </DialogContent>
    </Dialog>
  );
}
