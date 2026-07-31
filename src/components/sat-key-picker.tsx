import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import type { SatItem } from "@/lib/sat-catalogs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function SatKeyPicker({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (code: string) => void;
  items: SatItem[];
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ff-input flex items-center justify-between gap-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? (
              <>
                <span className="font-mono text-muted-foreground">{selected.code}</span> —{" "}
                {selected.name}
              </>
            ) : (
              <span className="text-muted-foreground">Buscar clave SAT…</span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Busca por nombre o código…" />
          <CommandList>
            <CommandEmpty>Sin resultados. Prueba con otra palabra.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.code}
                  value={`${item.code} ${item.name}`}
                  onSelect={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                >
                  <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                    {item.code}
                  </span>
                  <span className="truncate">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
