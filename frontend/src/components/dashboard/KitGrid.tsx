import React from "react";
import { SafeKitSummary } from "@/types/kit.js";
import { KitCard } from "./KitCard.js";

export interface KitGridProps {
  kits: SafeKitSummary[];
  onDeleteKit: (kit: SafeKitSummary) => void;
}

export const KitGrid: React.FC<KitGridProps> = ({ kits, onDeleteKit }) => {
  return (
    <section
      aria-label="Interview Kits List"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "var(--space-6)",
        alignItems: "stretch",
      }}
    >
      {kits.map((kit) => (
        <KitCard
          key={kit._id}
          kit={kit}
          onDelete={onDeleteKit}
        />
      ))}
    </section>
  );
};
