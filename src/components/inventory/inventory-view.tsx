"use client";

import {
  Boxes,
  Hash,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  CategoryLabel,
  ConditionBadge,
  LowStockBadge,
} from "@/components/inventory/inventory-badges";
import { ItemDetailDialog } from "@/components/inventory/item-detail-dialog";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { TeamBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SimpleSelect, type SelectOption } from "@/components/shared/simple-select";
import {
  nextSort,
  PlainHeader,
  SortHeader,
  type SortState,
} from "@/components/shared/sort-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { INVENTORY_CATEGORIES, INVENTORY_CONDITIONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { isLowStock, summarizeInventory } from "@/lib/inventory";
import { canManageInventory } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/providers/auth-provider";
import { useData } from "@/providers/data-provider";
import type { InventoryCategory, InventoryItem, TeamId } from "@/types";

type SortKey = "id" | "name" | "category" | "quantity" | "location" | "condition" | "team" | "updated";
type TeamOption = "all" | "shared" | TeamId;

const CATEGORY_OPTIONS: SelectOption<"all" | InventoryCategory>[] = [
  { value: "all", label: "All categories" },
  ...INVENTORY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

export function InventoryView() {
  const user = useCurrentUser();
  const { inventory, teams, getTeam, deleteItem } = useData();
  const mayManage = canManageInventory(user);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | InventoryCategory>("all");
  const [team, setTeam] = useState<TeamOption>("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "name", direction: "asc" });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | undefined>();
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  // Keeps the confirm text stable while that dialog closes.
  const [lastDeleting, setLastDeleting] = useState<InventoryItem | null>(null);

  const summary = useMemo(() => summarizeInventory(inventory), [inventory]);

  const teamOptions = useMemo<SelectOption<TeamOption>[]>(
    () => [
      { value: "all", label: "All teams" },
      ...teams.map((t) => ({ value: t.id as TeamOption, label: t.name })),
      { value: "shared", label: "Shared" },
    ],
    [teams],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = inventory.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (team === "shared" && item.teamId !== null) return false;
      if (team !== "all" && team !== "shared" && item.teamId !== team) return false;
      if (lowOnly && !isLowStock(item)) return false;
      if (query) {
        const haystack = [item.id, item.name, item.description, item.location, item.category]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const teamName = (item: InventoryItem) =>
      item.teamId ? (teams.find((t) => t.id === item.teamId)?.name ?? "") : "Shared";
    const comparators: Record<SortKey, (a: InventoryItem, b: InventoryItem) => number> = {
      id: (a, b) => a.id.localeCompare(b.id),
      name: (a, b) => a.name.localeCompare(b.name),
      category: (a, b) => a.category.localeCompare(b.category),
      quantity: (a, b) => a.quantity - b.quantity,
      location: (a, b) => a.location.localeCompare(b.location),
      condition: (a, b) =>
        INVENTORY_CONDITIONS.indexOf(a.condition) - INVENTORY_CONDITIONS.indexOf(b.condition),
      team: (a, b) => teamName(a).localeCompare(teamName(b)),
      updated: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
    };
    const direction = sort.direction === "asc" ? 1 : -1;
    return filtered.sort(
      (a, b) => comparators[sort.key](a, b) * direction || a.name.localeCompare(b.name),
    );
  }, [inventory, teams, search, category, team, lowOnly, sort]);

  const filtersActive = search.trim() !== "" || category !== "all" || team !== "all" || lowOnly;

  function resetFilters() {
    setSearch("");
    setCategory("all");
    setTeam("all");
    setLowOnly(false);
  }

  function openForm(item?: InventoryItem) {
    setEditing(item);
    setFormOpen(true);
  }

  const onSort = (key: SortKey) => setSort((current) => nextSort(current, key));
  const confirmTarget = deleting ?? lastDeleting;

  return (
    <>
      <PageHeader
        title="Inventory"
        context={mayManage ? "Organization-wide" : "Organization-wide · View only"}
        actions={
          mayManage && (
            <Button onClick={() => openForm()}>
              <Plus aria-hidden />
              Add item
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Items" value={summary.entries} icon={Boxes} hint="Distinct entries" />
          <StatCard
            label="Total units"
            value={summary.units.toLocaleString("en-US")}
            icon={Hash}
            hint="Across all items"
          />
          <StatCard
            label="Low stock"
            value={summary.lowStock}
            icon={TriangleAlert}
            hint={summary.lowStock > 0 ? "At or below threshold" : "Everything is stocked"}
          />
          <StatCard
            label="Needs attention"
            value={summary.needsAttention}
            icon={Wrench}
            hint="Needs repair or out of service"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-brand-slate"
                aria-hidden
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, ID, or location"
                aria-label="Search inventory"
                className="pl-8"
              />
            </div>
            <SimpleSelect
              ariaLabel="Filter by category"
              className="w-[calc(50%-0.25rem)] sm:w-40"
              value={category}
              onChange={setCategory}
              options={CATEGORY_OPTIONS}
            />
            <SimpleSelect
              ariaLabel="Filter by team"
              className="w-[calc(50%-0.25rem)] sm:w-36"
              value={team}
              onChange={setTeam}
              options={teamOptions}
            />
            <Button
              variant="outline"
              aria-pressed={lowOnly}
              onClick={() => setLowOnly((value) => !value)}
              className={cn(lowOnly && "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100")}
            >
              <TriangleAlert aria-hidden />
              Low stock only
            </Button>
            {filtersActive && (
              <Button variant="ghost" className="text-muted-foreground" onClick={resetFilters}>
                Reset
              </Button>
            )}
            <p className="ml-auto text-xs text-muted-foreground tabular-nums">
              {rows.length === inventory.length
                ? `${inventory.length} items`
                : `${rows.length} of ${inventory.length} items`}
            </p>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title={inventory.length === 0 ? "The inventory is empty" : "No items match these filters"}
              description={
                inventory.length === 0
                  ? mayManage
                    ? "Add the first item to start tracking equipment."
                    : "Items added by an admin will appear here."
                  : "Try a different search or reset the filters."
              }
              action={
                inventory.length === 0 ? (
                  mayManage && (
                    <Button onClick={() => openForm()}>
                      <Plus aria-hidden />
                      Add item
                    </Button>
                  )
                ) : (
                  <Button variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHeader
                    label="ID"
                    sortKey="id"
                    sort={sort}
                    onSort={onSort}
                    className="hidden pl-4 lg:table-cell"
                  />
                  <SortHeader
                    label="Item"
                    sortKey="name"
                    sort={sort}
                    onSort={onSort}
                    className="pl-4 lg:pl-2"
                  />
                  <SortHeader
                    label="Category"
                    sortKey="category"
                    sort={sort}
                    onSort={onSort}
                    className="hidden md:table-cell"
                  />
                  <SortHeader label="Qty" sortKey="quantity" sort={sort} onSort={onSort} align="right" />
                  <SortHeader
                    label="Location"
                    sortKey="location"
                    sort={sort}
                    onSort={onSort}
                    className="hidden lg:table-cell"
                  />
                  <SortHeader
                    label="Condition"
                    sortKey="condition"
                    sort={sort}
                    onSort={onSort}
                    className="hidden sm:table-cell"
                  />
                  <SortHeader
                    label="Team"
                    sortKey="team"
                    sort={sort}
                    onSort={onSort}
                    className="hidden md:table-cell"
                  />
                  <SortHeader
                    label="Updated"
                    sortKey="updated"
                    sort={sort}
                    onSort={onSort}
                    className={cn("hidden xl:table-cell", !mayManage && "pr-4")}
                  />
                  {mayManage && (
                    <PlainHeader className="w-20 pr-4 text-right">
                      <span className="sr-only">Actions</span>
                    </PlainHeader>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const low = isLowStock(item);
                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => setDetailId(item.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="hidden py-3 pl-4 font-mono text-xs text-muted-foreground lg:table-cell">
                        {item.id}
                      </TableCell>
                      <TableCell className="w-full max-w-0 py-3 pl-4 whitespace-normal sm:w-[30%] lg:pl-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailId(item.id);
                          }}
                          className="block w-full rounded text-left"
                        >
                          <span className="block truncate text-[13px] font-medium text-foreground">
                            {item.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            <span className="font-mono lg:hidden">{item.id} · </span>
                            {item.description || item.location}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <CategoryLabel category={item.category} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          {low && <LowStockBadge className="max-sm:hidden" />}
                          {low && (
                            <TriangleAlert className="size-3.5 text-amber-600 sm:hidden" aria-label="Low stock" />
                          )}
                          <span className="text-sm font-medium text-foreground tabular-nums">
                            {item.quantity}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden max-w-48 truncate text-xs text-foreground lg:table-cell">
                        {item.location}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <ConditionBadge condition={item.condition} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <TeamBadge team={item.teamId ? getTeam(item.teamId) : null} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "hidden text-xs whitespace-nowrap text-muted-foreground xl:table-cell",
                          !mayManage && "pr-4",
                        )}
                      >
                        {formatDateTime(item.updatedAt)}
                      </TableCell>
                      {mayManage && (
                        <TableCell className="pr-3 text-right">
                          <span className="inline-flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Edit ${item.name}`}
                              title="Edit"
                              onClick={(event) => {
                                event.stopPropagation();
                                openForm(item);
                              }}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Delete ${item.name}`}
                              title="Delete"
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                setLastDeleting(item);
                                setDeleting(item);
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </span>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </PageBody>

      <ItemDetailDialog itemId={detailId} onClose={() => setDetailId(null)} />

      {mayManage && <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} />}
      {mayManage && confirmTarget && (
        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          title={`Delete ${confirmTarget.name}?`}
          description={`${confirmTarget.id} will be permanently removed from the inventory.`}
          confirmLabel="Delete item"
          onConfirm={() => void deleteItem(confirmTarget.id)}
        />
      )}
    </>
  );
}
