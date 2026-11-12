"use client";

import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  CATEGORY_ICONS,
  CategoryLabel,
  ConditionBadge,
  LowStockBadge,
} from "@/components/inventory/inventory-badges";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { TeamBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { isLowStock } from "@/lib/inventory";
import { canManageInventory } from "@/lib/permissions";
import { useCurrentUser } from "@/providers/auth-provider";
import { useData } from "@/providers/data-provider";
import type { InventoryItem } from "@/types";

interface ItemDetailDialogProps {
  /** ID of the item to show, or null to close the dialog. */
  itemId: string | null;
  onClose: () => void;
}

export function ItemDetailDialog({ itemId, onClose }: ItemDetailDialogProps) {
  const { inventory } = useData();
  const item = itemId ? inventory.find((i) => i.id === itemId) : undefined;

  // Keep showing the last item while the dialog animates closed.
  const [shown, setShown] = useState<InventoryItem | undefined>(item);
  if (item && item !== shown) setShown(item);

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
        {shown && <ItemDetail item={shown} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ItemDetail({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const user = useCurrentUser();
  const { getTeam, updateItem, deleteItem } = useData();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const mayManage = canManageInventory(user);
  const Icon = CATEGORY_ICONS[item.category];
  const low = isLowStock(item);
  const showImage = Boolean(item.imageUrl) && !imageFailed;

  function adjustQuantity(delta: number) {
    const quantity = Math.max(0, item.quantity + delta);
    if (quantity !== item.quantity) void updateItem(item.id, { quantity }, `Quantity set to ${quantity}`);
  }

  return (
    <>
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3.5 pr-12">
        {showImage ? (
          // Remote, user-provided URL: next/image would need every host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            onError={() => setImageFailed(true)}
            className="size-12 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-brand-slate">
            <Icon className="size-6" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium text-muted-foreground">{item.id}</p>
          <DialogTitle className="mt-0.5 leading-snug">{item.name}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {item.description || "No description provided."}
          </DialogDescription>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <div>
            <p className="text-xs text-muted-foreground">Quantity on hand</p>
            <p className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-foreground tabular-nums">
              {item.quantity}
              {low && <LowStockBadge />}
            </p>
            {item.lowStockThreshold > 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Flagged as low at {item.lowStockThreshold} or fewer
              </p>
            )}
          </div>
          {mayManage && (
            <div className="flex items-center gap-1.5" role="group" aria-label="Adjust quantity">
              <Button
                variant="outline"
                size="icon"
                aria-label="Decrease quantity by 1"
                disabled={item.quantity === 0}
                onClick={() => adjustQuantity(-1)}
              >
                <Minus />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Increase quantity by 1"
                onClick={() => adjustQuantity(1)}
              >
                <Plus />
              </Button>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-[8rem_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
          <Property label="Category">
            <CategoryLabel category={item.category} />
          </Property>
          <Property label="Storage location">{item.location}</Property>
          <Property label="Condition">
            <ConditionBadge condition={item.condition} />
          </Property>
          <Property label="Assigned team">
            <TeamBadge team={item.teamId ? getTeam(item.teamId) : null} />
          </Property>
          <Property label="Last updated">{formatDateTime(item.updatedAt)}</Property>
        </dl>

        {item.notes && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Notes
            </h3>
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {item.notes}
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-muted/60 px-4 py-3 sm:flex-row sm:items-center">
        {mayManage && (
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        )}
        <Button variant="outline" className="sm:ml-auto" onClick={onClose}>
          Close
        </Button>
        {mayManage && (
          <Button onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            Edit item
          </Button>
        )}
      </div>

      {/* Rendered inside the dialog so they stack as nested dialogs. */}
      {mayManage && <ItemFormDialog open={editOpen} onOpenChange={setEditOpen} item={item} />}
      {mayManage && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${item.name}?`}
          description={`${item.id} will be permanently removed from the inventory.`}
          confirmLabel="Delete item"
          onConfirm={async () => {
            if (await deleteItem(item.id)) onClose();
          }}
        />
      )}
    </>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </>
  );
}
