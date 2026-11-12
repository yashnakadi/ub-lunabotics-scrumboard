"use client";

import { useState, type FormEvent } from "react";

import { Field } from "@/components/shared/field";
import { SimpleSelect } from "@/components/shared/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INVENTORY_CATEGORIES, INVENTORY_CONDITIONS } from "@/lib/constants";
import type { InventoryInput } from "@/lib/services";
import { useData } from "@/providers/data-provider";
import type { InventoryCategory, InventoryCondition, InventoryItem, TeamId } from "@/types";

const SHARED = "shared";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an item to edit it; omit to add a new one. */
  item?: InventoryItem;
}

/** Admin dialog for adding or editing an inventory item. */
export function ItemFormDialog({ open, onOpenChange, item }: ItemFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <ItemForm item={item} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type Errors = Partial<Record<"name" | "quantity" | "threshold" | "location" | "imageUrl", string>>;

function parseCount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

function ItemForm({ item, onDone }: { item?: InventoryItem; onDone: () => void }) {
  const { teams, createItem, updateItem } = useData();
  const editing = Boolean(item);

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<InventoryCategory>(item?.category ?? "Electrical");
  const [description, setDescription] = useState(item?.description ?? "");
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [threshold, setThreshold] = useState(String(item?.lowStockThreshold ?? 0));
  const [location, setLocation] = useState(item?.location ?? "");
  const [condition, setCondition] = useState<InventoryCondition>(item?.condition ?? "Good");
  const [teamId, setTeamId] = useState<string>(item ? (item.teamId ?? SHARED) : SHARED);
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter the item name.";
    if (parseCount(quantity) === null) next.quantity = "Enter a whole number, 0 or more.";
    if (parseCount(threshold) === null) next.threshold = "Enter a whole number, 0 or more.";
    if (!location.trim()) next.location = "Enter where this item is stored.";
    if (imageUrl.trim()) {
      try {
        const url = new URL(imageUrl.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      } catch {
        next.imageUrl = "Enter a full image URL starting with https://";
      }
    }
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validate();
    setErrors(validation);
    const firstInvalid = (["name", "quantity", "threshold", "location", "imageUrl"] as const).find(
      (key) => validation[key],
    );
    if (firstInvalid) {
      document.getElementById(`item-${firstInvalid}`)?.focus();
      return;
    }

    const input: InventoryInput = {
      name: name.trim(),
      category,
      description: description.trim(),
      quantity: parseCount(quantity) ?? 0,
      lowStockThreshold: parseCount(threshold) ?? 0,
      location: location.trim(),
      condition,
      teamId: teamId === SHARED ? null : (teamId as TeamId),
      imageUrl: imageUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    const saved = item
      ? await updateItem(item.id, input, `Saved changes to ${input.name}`)
      : await createItem(input);
    setSaving(false);
    if (saved) onDone();
  }

  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3.5 pr-12">
        <DialogTitle>{editing ? `Edit ${item?.code}` : "Add inventory item"}</DialogTitle>
        <DialogDescription className="mt-1 text-xs">
          {editing
            ? "Update quantity, storage location, or other details."
            : "Record a part, tool, or piece of equipment owned by the team."}
        </DialogDescription>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
        <Field label="Item name" htmlFor="item-name" error={errors.name} required>
          <Input
            id="item-name"
            value={name}
            placeholder="e.g. Raspberry Pi 5 (8 GB)"
            onChange={(e) => {
              setName(e.target.value);
              clear("name");
            }}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? "item-name-error" : undefined}
            aria-required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="item-category">
            <SimpleSelect
              id="item-category"
              value={category}
              onChange={setCategory}
              options={INVENTORY_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Assigned team" htmlFor="item-team">
            <SimpleSelect
              id="item-team"
              value={teamId}
              onChange={setTeamId}
              options={[
                { value: SHARED, label: "Shared (all teams)" },
                ...teams.map((team) => ({ value: team.id as string, label: team.name })),
              ]}
            />
          </Field>
        </div>

        <Field label="Description" htmlFor="item-description">
          <Textarea
            id="item-description"
            value={description}
            rows={2}
            placeholder="What it is and what it's used for"
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-16 bg-white"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quantity" htmlFor="item-quantity" error={errors.quantity} required>
            <Input
              id="item-quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                clear("quantity");
              }}
              aria-invalid={Boolean(errors.quantity) || undefined}
              aria-describedby={errors.quantity ? "item-quantity-error" : undefined}
              aria-required
            />
          </Field>
          <Field
            label="Low-stock threshold"
            htmlFor="item-threshold"
            error={errors.threshold}
            hint="Flag at or below this. 0 = off."
          >
            <Input
              id="item-threshold"
              inputMode="numeric"
              value={threshold}
              onChange={(e) => {
                setThreshold(e.target.value);
                clear("threshold");
              }}
              aria-invalid={Boolean(errors.threshold) || undefined}
              aria-describedby={errors.threshold ? "item-threshold-error" : undefined}
            />
          </Field>
          <Field label="Condition" htmlFor="item-condition">
            <SimpleSelect
              id="item-condition"
              value={condition}
              onChange={setCondition}
              options={INVENTORY_CONDITIONS.map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </div>

        <Field label="Storage location" htmlFor="item-location" error={errors.location} required>
          <Input
            id="item-location"
            value={location}
            placeholder="e.g. Lab · Electronics Cabinet A"
            onChange={(e) => {
              setLocation(e.target.value);
              clear("location");
            }}
            aria-invalid={Boolean(errors.location) || undefined}
            aria-describedby={errors.location ? "item-location-error" : undefined}
            aria-required
          />
        </Field>

        <Field
          label="Image URL"
          htmlFor="item-imageUrl"
          error={errors.imageUrl}
          hint="Optional. Link to a photo of the item."
        >
          <Input
            id="item-imageUrl"
            type="url"
            inputMode="url"
            value={imageUrl}
            placeholder="https://"
            onChange={(e) => {
              setImageUrl(e.target.value);
              clear("imageUrl");
            }}
            aria-invalid={Boolean(errors.imageUrl) || undefined}
            aria-describedby={errors.imageUrl ? "item-imageUrl-error" : undefined}
          />
        </Field>

        <Field label="Notes" htmlFor="item-notes" hint="Optional. Handling, maintenance, or reorder notes.">
          <Textarea
            id="item-notes"
            value={notes}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-16 bg-white"
          />
        </Field>
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-muted/60 px-4 py-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {editing ? "Save changes" : "Add item"}
        </Button>
      </div>
    </form>
  );
}
