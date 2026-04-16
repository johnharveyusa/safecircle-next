"use client";

import { useState, useEffect, useCallback } from "react";

export interface CrimeIncident {
  attributes: {
    Offense_Datetime: number;
    UCR_Category: string;
    UCR_Description: string;
    Street_Address: string;
    Latitude: number;
    Longitude: number;
    Crime_ID: string;
    Precinct: string;
  };
}

export interface SexOffender {
  name?: string;
  address?: string;
  [key: string]: unknown;
}

export interface Warrant {
  name?: string;
  dob?: string;
  [key: string]: unknown;
}

export interface EmergencyContact {
  name?: string;
  type?: string;
  address?: string;
  phone?: string;
  distance?: number;
  [key: string]: unknown;
}

export interface SafeCircleData {
  crimes: CrimeIncident[];
  offenders: SexOffender[];
  warrants: {
    found: boolean;
    count: number;
    search_url: string;
    warrants: Warrant[];
  } | null;
  contacts: EmergencyContact[];
  center: { lat: number; lng: number } | null;
}

export interface SafeCircleErrors {
  crimes?: string;
  offenders?: string;
  warrants?: string;
  contacts?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

export function useSafeCircleData(address: string | null) {
  const [data, setData] = useState<SafeCircleData>({
    crimes: [],
    offenders: [],
    warrants: null,
    contacts: [],
    center: null,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<SafeCircleErrors>({});

  const fetch_all = useCallback(async (addr: string) => {
    if (!addr.trim()) return;
    setLoading(true);
    setErrors({});

    const q = encodeURIComponent(addr);

    const [crimesResult, offendersResult, warrantsResult, contactsResult] =
      await Promise.allSettled([
        fetchJson<{ incidents: CrimeIncident[]; center: { lat: number; lng: number } }>(
          `/api/crimes?address=${q}`
        ),
        fetchJson<{ offenders: SexOffender[] }>(`/api/offenders?address=${q}`),
        fetchJson<{
          found: boolean;
          count: number;
          search_url: string;
          warrants: Warrant[];
        }>(`/api/warrants?address=${q}`),
        fetchJson<{ contacts: EmergencyContact[]; center: { lat: number; lng: number } }>(
          `/api/contacts?address=${q}`
        ),
      ]);

    const newErrors: SafeCircleErrors = {};
    const newData: SafeCircleData = {
      crimes: [],
      offenders: [],
      warrants: null,
      contacts: [],
      center: null,
    };

    if (crimesResult.status === "fulfilled") {
      newData.crimes = crimesResult.value.incidents ?? [];
      newData.center = crimesResult.value.center ?? null;
    } else {
      newErrors.crimes = crimesResult.reason?.message ?? "Could not load crime data";
    }

    if (offendersResult.status === "fulfilled") {
      newData.offenders = offendersResult.value.offenders ?? [];
    } else {
      newErrors.offenders = offendersResult.reason?.message ?? "Could not load offender data";
    }

    if (warrantsResult.status === "fulfilled") {
      newData.warrants = warrantsResult.value;
    } else {
      newErrors.warrants = warrantsResult.reason?.message ?? "Could not load warrant data";
    }

    if (contactsResult.status === "fulfilled") {
      newData.contacts = contactsResult.value.contacts ?? [];
      if (!newData.center) newData.center = contactsResult.value.center ?? null;
    } else {
      newErrors.contacts = contactsResult.reason?.message ?? "Could not load emergency contacts";
    }

    setData(newData);
    setErrors(newErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (address) fetch_all(address);
  }, [address, fetch_all]);

  return { data, loading, errors, refresh: () => address && fetch_all(address) };
}
