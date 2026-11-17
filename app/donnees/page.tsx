"use client";
import React, { useState, useEffect } from "react";
import { DonneesView } from "../../components/donnees-view";
import { useApp } from "../../components/app-context";
import { api, type Catalog } from "../../lib/api-types";

export default function DonneesPage() {
  const { catalog: globalCat, can, refreshCatalog } = useApp();
  const [cat, setCat] = useState<Catalog | null>(globalCat);

  useEffect(() => {
    if (!cat) {
      api<Catalog>("catalog")
        .then(setCat)
        .catch(() => {});
    }
  }, [cat]);

  const handleRefresh = async () => {
    await refreshCatalog();
    const c = await api<Catalog>("catalog");
    setCat(c);
  };

  return (
    <DonneesView
      cat={cat || globalCat}
      can={can}
      onRefresh={handleRefresh}
    />
  );
}
